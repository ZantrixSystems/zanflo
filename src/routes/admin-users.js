import { getDb } from '../db/client.js';
import { writeAuditLog } from '../lib/audit.js';
import { requireTenantStaffWithPermissions, hasPermission } from '../lib/guards.js';
import { hashPassword } from '../lib/passwords.js';
import { validateBootstrapPassword } from '../lib/password-policy.js';

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
  return requireTenantStaffWithPermissions(request, env, 'tenant_admin', 'manager', 'officer');
}

function assertUsersManage(session) {
  if (!hasPermission(session, 'users.manage')) return { error: true };
  return null;
}

async function listUsers(request, env) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);
  if (!hasPermission(session, 'users.manage')) return error('Not authorised', 403);

  const sql = getDb(env);
  const rows = await sql`
    SELECT
      u.id,
      u.email,
      u.username,
      u.full_name,
      u.is_platform_admin,
      m.role,
      m.custom_role_id,
      cr.name AS custom_role_name,
      m.created_at
    FROM memberships m
    INNER JOIN users u ON u.id = m.user_id
    LEFT JOIN custom_roles cr ON cr.id = m.custom_role_id
    WHERE m.tenant_id = ${session.tenant_id}
    ORDER BY
      CASE m.role
        WHEN 'tenant_admin' THEN 1
        WHEN 'manager' THEN 2
        WHEN 'officer' THEN 3
        ELSE 9
      END,
      u.full_name ASC
  `;

  const customRoles = await sql`
    SELECT id, name FROM custom_roles
    WHERE tenant_id = ${session.tenant_id}
    ORDER BY name ASC
  `;

  return json({ users: rows, custom_roles: customRoles });
}

async function createUser(request, env) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);
  if (!hasPermission(session, 'users.manage')) return error('Not authorised', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const email = body.email?.trim().toLowerCase();
  const fullName = body.full_name?.trim();
  const role = body.role?.trim();
  const password = body.password;
  const username = email || null;

  if (!email || !email.includes('@')) return error('Valid email is required');
  if (!fullName) return error('full_name is required');
  if (!['tenant_admin', 'manager', 'officer'].includes(role)) return error('Invalid role');

  const sql = getDb(env);

  const existingUsers = await sql`
    SELECT id, email, username, full_name
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;

  let user = existingUsers[0] ?? null;

  if (!user) {
    if (!password || password.length < 12) return error('password must be at least 12 characters for a new user');
    const passwordHash = await hashPassword(password);

    const usernameClash = await sql`
      SELECT id FROM users
      WHERE LOWER(username) = ${username.toLowerCase()}
      LIMIT 1
    `;
    if (usernameClash.length > 0) return error('That username is already in use', 409);

    const rows = await sql`
      INSERT INTO users (email, username, password_hash, full_name, is_platform_admin)
      VALUES (${email}, ${username}, ${passwordHash}, ${fullName}, false)
      RETURNING id, email, username, full_name
    `;
    user = rows[0];
  }

  const membershipClash = await sql`
    SELECT id
    FROM memberships
    WHERE tenant_id = ${session.tenant_id}
      AND user_id = ${user.id}
    LIMIT 1
  `;
  if (membershipClash.length > 0) return error('User already belongs to this tenant', 409);

  await sql`
    INSERT INTO memberships (tenant_id, user_id, role)
    VALUES (${session.tenant_id}, ${user.id}, ${role})
  `;

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: 'tenant_admin',
    actorId: session.user_id,
    action: 'tenant_user.created',
    recordType: 'user',
    recordId: user.id,
    meta: { email: user.email, role },
  });

  return json({ user: { ...user, role } }, 201);
}

async function updateUser(request, env, userId) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);
  if (!hasPermission(session, 'users.manage')) return error('Not authorised', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const role = body.role?.trim();
  const fullName = body.full_name?.trim();
  const password = body.password;
  const customRoleId = body.custom_role_id !== undefined ? (body.custom_role_id || null) : undefined;

  if (!role && !fullName && !password && customRoleId === undefined) {
    return error('At least one field must be provided');
  }
  if (role && !['tenant_admin', 'manager', 'officer'].includes(role)) return error('Invalid role');
  if (password) {
    const policyError = validateBootstrapPassword(password);
    if (policyError) return error(policyError);
  }

  const sql = getDb(env);

  // Validate custom_role_id belongs to this tenant if provided
  if (customRoleId) {
    const crCheck = await sql`
      SELECT id FROM custom_roles
      WHERE id = ${customRoleId} AND tenant_id = ${session.tenant_id}
      LIMIT 1
    `;
    if (crCheck.length === 0) return error('Custom role not found', 404);
  }

  const existingRows = await sql`
    SELECT
      u.id,
      u.email,
      u.full_name,
      u.username,
      m.role
    FROM memberships m
    INNER JOIN users u ON u.id = m.user_id
    WHERE m.tenant_id = ${session.tenant_id}
      AND u.id = ${userId}
    LIMIT 1
  `;
  const existing = existingRows[0];
  if (!existing) return error('User not found', 404);

  if (fullName) {
    await sql`UPDATE users SET full_name = ${fullName} WHERE id = ${userId}`;
  }

  if (password) {
    const passwordHash = await hashPassword(password);
    await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
  }

  if (role) {
    await sql`
      UPDATE memberships
      SET role = ${role}
      WHERE tenant_id = ${session.tenant_id} AND user_id = ${userId}
    `;
  }

  if (customRoleId !== undefined) {
    await sql`
      UPDATE memberships
      SET custom_role_id = ${customRoleId}
      WHERE tenant_id = ${session.tenant_id} AND user_id = ${userId}
    `;
  }

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: 'tenant_admin',
    actorId: session.user_id,
    action: 'tenant_user.updated',
    recordType: 'user',
    recordId: userId,
    meta: {
      role: role ?? existing.role,
      full_name: fullName ?? existing.full_name,
      username: existing.email,
      password_reset: password ? true : undefined,
    },
  });

  const rows = await sql`
    SELECT
      u.id,
      u.email,
      u.username,
      u.full_name,
      u.is_platform_admin,
      m.role,
      m.custom_role_id,
      cr.name AS custom_role_name
    FROM memberships m
    INNER JOIN users u ON u.id = m.user_id
    LEFT JOIN custom_roles cr ON cr.id = m.custom_role_id
    WHERE m.tenant_id = ${session.tenant_id}
      AND u.id = ${userId}
    LIMIT 1
  `;

  return json({ user: rows[0] });
}

export async function handleAdminUserRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'GET' && url.pathname === '/api/admin/users') {
    return listUsers(request, env);
  }

  if (method === 'POST' && url.pathname === '/api/admin/users') {
    return createUser(request, env);
  }

  const match = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (match && method === 'PUT') {
    return updateUser(request, env, match[1]);
  }

  return null;
}
