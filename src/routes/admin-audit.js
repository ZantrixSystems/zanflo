import { getDb } from '../db/client.js';
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

async function listAudit(request, env) {
  const session = await requireTenantStaff(request, env, 'tenant_admin');
  if (!session) return error('Not authorised', 403);

  const sql = getDb(env);
  const rows = await sql`
    SELECT
      al.action,
      al.record_type AS target_type,
      al.record_id AS target_id,
      al.created_at AS timestamp,
      COALESCE(u.full_name, aa.full_name, 'System') AS actor
    FROM audit_logs al
    LEFT JOIN users u
      ON al.actor_id = u.id
      AND al.actor_type IN ('officer', 'manager', 'tenant_admin', 'platform_admin')
    LEFT JOIN applicant_accounts aa
      ON al.actor_id = aa.id
      AND al.actor_type = 'applicant'
    WHERE al.tenant_id = ${session.tenant_id}
    ORDER BY al.created_at DESC
    LIMIT 100
  `;

  return json({ audit_logs: rows });
}

export async function handleAdminAuditRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'GET' && url.pathname === '/api/admin/audit') {
    return listAudit(request, env);
  }

  return null;
}
