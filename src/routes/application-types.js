/**
 * Application types route.
 *
 * Returns the list of application types that are enabled for the
 * current tenant. This is what the frontend uses to populate
 * the "start a new application" screen.
 *
 * Routes:
 *   GET /application-types
 *
 * Auth: applicant session required.
 * Tenant: resolved from session (already verified at login).
 */

import { getDb } from '../db/client.js';
import { getApplicantSession } from '../lib/applicant-session.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

// ---------------------------------------------------------------------------
// GET /application-types
// ---------------------------------------------------------------------------
async function listApplicationTypes(request, env) {
  const session = await getApplicantSession(request, env.JWT_SECRET);
  if (!session) return error('Not authenticated', 401);

  const sql = getDb(env);

  // Only return types the tenant has enabled
  const rows = await sql`
    SELECT
      at.id,
      at.slug,
      at.name,
      at.description
    FROM application_types at
    INNER JOIN tenant_enabled_application_types teat
      ON teat.application_type_id = at.id
      AND teat.tenant_id = ${session.tenant_id}
    WHERE at.is_active = true
    ORDER BY at.name ASC
  `;

  return json({ application_types: rows });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export async function handleApplicationTypeRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'GET' && url.pathname === '/application-types') {
    return listApplicationTypes(request, env);
  }

  return null;
}
