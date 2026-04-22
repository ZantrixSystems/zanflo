import { getDb } from '../db/client.js';
import { writeAuditLog } from '../lib/audit.js';
import { requireTenantStaff } from '../lib/guards.js';

// The canonical set of permission keys. Adding a new permission is a code change here.
export const ALL_PERMISSIONS = [
  'cases.view',
  'cases.assign',
  'cases.decide',
  'users.manage',
  'settings.view',
  'settings.edit',
  'audit.view',
];

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

async function listRoles(request, env) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);

  const sql = getDb(env);

  const roles = await sql`
    SELECT id, name, description, created_at
    FROM custom_roles
    WHERE tenant_id = ${session.tenant_id}
    ORDER BY name ASC
  `;

  const permissions = roles.length > 0
    ? await sql`
        SELECT role_id, permission_key
        FROM custom_role_permissions
        WHERE role_id = ANY(${roles.map((r) => r.id)})
      `
    : [];

  const permsByRole = {};
  for (const p of permissions) {
    if (!permsByRole[p.role_id]) permsByRole[p.role_id] = [];
    permsByRole[p.role_id].push(p.permission_key);
  }

  const result = roles.map((r) => ({
    ...r,
    permissions: permsByRole[r.id] ?? [],
  }));

  return json({ roles: result, all_permissions: ALL_PERMISSIONS });
}

async function createRole(request, env) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const name = body.name?.trim();
  const description = body.description?.trim() ?? '';
  const permissions = Array.isArray(body.permissions) ? body.permissions : [];

  if (!name) return error('name is required');
  if (name.length > 80) return error('name must be 80 characters or fewer');

  const invalid = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
  if (invalid.length > 0) return error(`Unknown permissions: ${invalid.join(', ')}`);

  const sql = getDb(env);

  const clash = await sql`
    SELECT id FROM custom_roles
    WHERE tenant_id = ${session.tenant_id}
      AND LOWER(name) = ${name.toLowerCase()}
    LIMIT 1
  `;
  if (clash.length > 0) return error('A role with that name already exists', 409);

  const rows = await sql`
    INSERT INTO custom_roles (tenant_id, name, description)
    VALUES (${session.tenant_id}, ${name}, ${description})
    RETURNING id, name, description, created_at
  `;
  const role = rows[0];

  if (permissions.length > 0) {
    await sql`
      INSERT INTO custom_role_permissions (role_id, permission_key)
      SELECT ${role.id}, unnest(${permissions}::text[])
    `;
  }

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: 'tenant_admin',
    actorId: session.user_id,
    action: 'custom_role.created',
    recordType: 'custom_role',
    recordId: role.id,
    meta: { name, permissions },
  });

  return json({ role: { ...role, permissions } }, 201);
}

async function updateRole(request, env, roleId) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const sql = getDb(env);

  const existing = await sql`
    SELECT id, name FROM custom_roles
    WHERE id = ${roleId}
      AND tenant_id = ${session.tenant_id}
    LIMIT 1
  `;
  if (existing.length === 0) return error('Role not found', 404);

  const name = body.name?.trim() ?? existing[0].name;
  const description = body.description?.trim() ?? '';
  const permissions = Array.isArray(body.permissions) ? body.permissions : [];

  if (!name) return error('name is required');
  if (name.length > 80) return error('name must be 80 characters or fewer');

  const invalid = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
  if (invalid.length > 0) return error(`Unknown permissions: ${invalid.join(', ')}`);

  if (name.toLowerCase() !== existing[0].name.toLowerCase()) {
    const clash = await sql`
      SELECT id FROM custom_roles
      WHERE tenant_id = ${session.tenant_id}
        AND LOWER(name) = ${name.toLowerCase()}
        AND id != ${roleId}
      LIMIT 1
    `;
    if (clash.length > 0) return error('A role with that name already exists', 409);
  }

  await sql`
    UPDATE custom_roles
    SET name = ${name}, description = ${description}, updated_at = now()
    WHERE id = ${roleId}
      AND tenant_id = ${session.tenant_id}
  `;

  await sql`
    DELETE FROM custom_role_permissions WHERE role_id = ${roleId}
  `;

  if (permissions.length > 0) {
    await sql`
      INSERT INTO custom_role_permissions (role_id, permission_key)
      SELECT ${roleId}, unnest(${permissions}::text[])
    `;
  }

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: 'tenant_admin',
    actorId: session.user_id,
    action: 'custom_role.updated',
    recordType: 'custom_role',
    recordId: roleId,
    meta: { name, permissions },
  });

  const updated = await sql`
    SELECT id, name, description, created_at FROM custom_roles
    WHERE id = ${roleId}
  `;

  return json({ role: { ...updated[0], permissions } });
}

async function deleteRole(request, env, roleId) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);

  const sql = getDb(env);

  const existing = await sql`
    SELECT id, name FROM custom_roles
    WHERE id = ${roleId}
      AND tenant_id = ${session.tenant_id}
    LIMIT 1
  `;
  if (existing.length === 0) return error('Role not found', 404);

  await sql`DELETE FROM custom_roles WHERE id = ${roleId}`;

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: 'tenant_admin',
    actorId: session.user_id,
    action: 'custom_role.deleted',
    recordType: 'custom_role',
    recordId: roleId,
    meta: { name: existing[0].name },
  });

  return json({ ok: true });
}

export async function handleAdminRoleRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'GET' && url.pathname === '/api/admin/roles') {
    return listRoles(request, env);
  }

  if (method === 'POST' && url.pathname === '/api/admin/roles') {
    return createRole(request, env);
  }

  const match = url.pathname.match(/^\/api\/admin\/roles\/([^/]+)$/);
  if (match) {
    if (method === 'PUT') return updateRole(request, env, match[1]);
    if (method === 'DELETE') return deleteRole(request, env, match[1]);
  }

  return null;
}
