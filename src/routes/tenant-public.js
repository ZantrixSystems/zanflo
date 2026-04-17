import { getDb } from '../db/client.js';
import { resolveTenant } from '../lib/tenant-resolver.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

async function getTenantPublicConfig(request, env) {
  const sql = getDb(env);
  const tenant = await resolveTenant(request, sql, env);
  if (!tenant) return error('Tenant not found or not available', 403);

  const rows = await sql`
    SELECT
      t.id,
      t.name,
      t.slug,
      t.subdomain,
      ts.council_display_name,
      ts.support_email,
      ts.support_phone,
      ts.support_contact_name,
      ts.logo_url,
      ts.welcome_text,
      ts.public_homepage_text,
      ts.contact_us_text
    FROM tenants t
    LEFT JOIN tenant_settings ts ON ts.tenant_id = t.id
    WHERE t.id = ${tenant.id}
    LIMIT 1
  `;

  const row = rows[0];
  return json({
    tenant: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      subdomain: row.subdomain,
      hostname: `${row.subdomain}.zanflo.com`,
      display_name: row.council_display_name || row.name,
      support_email: row.support_email,
      support_phone: row.support_phone,
      support_contact_name: row.support_contact_name,
      logo_url: row.logo_url,
      welcome_text: row.welcome_text,
      public_homepage_text: row.public_homepage_text,
      contact_us_text: row.contact_us_text,
    },
  });
}

export async function handleTenantPublicRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'GET' && url.pathname === '/api/tenant/public-config') {
    return getTenantPublicConfig(request, env);
  }

  return null;
}
