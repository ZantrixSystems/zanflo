/**
 * Platform public routes.
 *
 * These routes are for zanflo.com itself, not tenant portals.
 * They support controlled onboarding intake only. They do NOT
 * provision tenants, issue credentials, or configure DNS.
 */

import { getDb } from '../db/client.js';
import { writeAuditLog } from '../lib/audit.js';
import { validateSubdomain } from '../lib/subdomains.js';

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

function normaliseEmail(value) {
  return value?.trim().toLowerCase() ?? '';
}

function isWorkEmail(email) {
  const [, domain] = email.split('@');
  if (!domain) return false;
  return !PERSONAL_EMAIL_DOMAINS.has(domain);
}

async function createOnboardingRequest(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const organisationName = body.organisation_name?.trim() ?? '';
  const contactName = body.contact_name?.trim() ?? '';
  const workEmail = normaliseEmail(body.work_email);
  const requestedSubdomain = body.requested_subdomain?.trim().toLowerCase() ?? '';
  const message = body.message?.trim() || null;

  if (!organisationName) return error('organisation_name is required');
  if (!contactName) return error('contact_name is required');
  if (!workEmail) return error('work_email is required');
  if (!workEmail.includes('@')) return error('work_email must be a valid email address');
  if (!isWorkEmail(workEmail)) return error('Please use a work email address');

  const subdomainError = validateSubdomain(requestedSubdomain);
  if (subdomainError) return error(subdomainError);

  const sql = getDb(env);

  const tenantClash = await sql`
    SELECT id
    FROM tenants
    WHERE slug = ${requestedSubdomain}
       OR subdomain = ${requestedSubdomain}
    LIMIT 1
  `;
  if (tenantClash.length > 0) return error('requested subdomain is already in use', 409);

  const requestClash = await sql`
    SELECT id
    FROM tenant_onboarding_requests
    WHERE requested_subdomain = ${requestedSubdomain}
      AND status = 'pending'
    LIMIT 1
  `;
  if (requestClash.length > 0) {
    return error('A pending request already exists for that subdomain', 409);
  }

  const rows = await sql`
    INSERT INTO tenant_onboarding_requests (
      organisation_name,
      contact_name,
      work_email,
      requested_subdomain,
      message,
      status,
      updated_at
    )
    VALUES (
      ${organisationName},
      ${contactName},
      ${workEmail},
      ${requestedSubdomain},
      ${message},
      'pending',
      NOW()
    )
    RETURNING id, organisation_name, contact_name, work_email, requested_subdomain, message, status, created_at
  `;

  const onboardingRequest = rows[0];

  await writeAuditLog(sql, {
    tenantId: null,
    actorType: 'system',
    actorId: null,
    action: 'tenant_onboarding_request.created',
    recordType: 'tenant_onboarding_request',
    recordId: onboardingRequest.id,
    meta: {
      organisation_name: onboardingRequest.organisation_name,
      requested_subdomain: onboardingRequest.requested_subdomain,
      work_email: onboardingRequest.work_email,
    },
  });

  return json({
    request: onboardingRequest,
    message: 'Request received. We will review it and contact you directly.',
  }, 201);
}

export async function handlePlatformPublicRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'POST' && url.pathname === '/api/platform/request-access') {
    return createOnboardingRequest(request, env);
  }

  return null;
}
