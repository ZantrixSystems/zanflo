import { getDb } from '../db/client.js';
import { writeAuditLog } from '../lib/audit.js';
import { requireTenantStaff } from '../lib/guards.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

async function requireTenantAdmin(request, env) {
  return requireTenantStaff(request, env, 'tenant_admin');
}

async function getSettings(request, env) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);

  const sql = getDb(env);
  const rows = await sql`
    SELECT
      t.id,
      t.name,
      t.slug,
      t.subdomain,
      t.status,
      t.contact_name,
      t.contact_email,
      tl.max_staff_users,
      tl.max_applications
    FROM tenants t
    LEFT JOIN tenant_limits tl ON tl.tenant_id = t.id
    WHERE t.id = ${session.tenant_id}
    LIMIT 1
  `;

  if (rows.length === 0) return error('Tenant not found', 404);
  return json({ settings: rows[0] });
}

async function updateSettings(request, env) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const name = body.name?.trim();
  const contactName = body.contact_name?.trim() ?? null;
  const contactEmail = body.contact_email?.trim().toLowerCase() ?? null;

  if (contactEmail && !contactEmail.includes('@')) return error('contact_email must be a valid email address');

  const sql = getDb(env);
  const rows = await sql`
    UPDATE tenants
    SET
      name = COALESCE(${name}, name),
      contact_name = ${contactName},
      contact_email = ${contactEmail}
    WHERE id = ${session.tenant_id}
    RETURNING id, name, slug, subdomain, status, contact_name, contact_email
  `;

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: 'tenant_admin',
    actorId: session.user_id,
    action: 'tenant.settings.updated',
    recordType: 'tenant',
    recordId: session.tenant_id,
    meta: {
      name: rows[0].name,
      contact_name: rows[0].contact_name,
      contact_email: rows[0].contact_email,
    },
  });

  return json({ settings: rows[0] });
}

export async function handleAdminSettingsRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'GET' && url.pathname === '/api/admin/settings') {
    return getSettings(request, env);
  }

  if (method === 'PUT' && url.pathname === '/api/admin/settings') {
    return updateSettings(request, env);
  }

  return null;
}
