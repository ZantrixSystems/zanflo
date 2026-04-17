import { getDb } from '../db/client.js';
import { verifyPassword } from '../lib/passwords.js';
import { buildCookie, clearCookie, signSession } from '../lib/session.js';
import { requireStaff } from '../lib/guards.js';
import { isPlatformHost } from '../lib/request-context.js';
import { resolveTenant } from '../lib/tenant-resolver.js';

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

async function login(request, env) {
  if (isPlatformHost(request)) return error('Not found', 404);

  const sql = getDb(env);
  const tenant = await resolveTenant(request, sql, env);
  if (!tenant) return error('Tenant not found or not available', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const identifier = body.identifier?.trim() || body.email?.trim() || '';
  const { password } = body;
  if (!identifier || !password) {
    return error('Username or email and password are required');
  }

  const rows = await sql`
    SELECT
      u.id,
      u.email,
      u.username,
      u.full_name,
      u.password_hash,
      u.is_platform_admin,
      m.role,
      m.tenant_id
    FROM memberships m
    INNER JOIN users u ON u.id = m.user_id
    WHERE m.tenant_id = ${tenant.id}
      AND (
        u.email = ${identifier.toLowerCase()}
        OR LOWER(COALESCE(u.username, '')) = ${identifier.toLowerCase()}
      )
    LIMIT 1
  `;

  if (rows.length === 0) return error('Invalid credentials', 401);
  const user = rows[0];

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return error('Invalid credentials', 401);

  const token = await signSession({
    user_id: user.id,
    email: user.email,
    username: user.username,
    full_name: user.full_name,
    is_platform_admin: user.is_platform_admin,
    tenant_id: tenant.id,
    tenant_slug: tenant.slug,
    role: user.role,
  }, env.JWT_SECRET);

  return json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      is_platform_admin: user.is_platform_admin,
    },
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
    },
    role: user.role,
  }, 200, {
    'Set-Cookie': buildCookie(token),
  });
}

async function logout(request) {
  if (isPlatformHost(request)) return error('Not found', 404);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearCookie(),
    },
  });
}

async function me(request, env) {
  if (isPlatformHost(request)) return error('Not found', 404);

  const session = await requireStaff(request, env);
  if (!session) return error('Not authenticated', 401);

  return json({ session });
}

export async function handleStaffAuthRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'POST' && url.pathname === '/api/staff/login') return login(request, env);
  if (method === 'POST' && url.pathname === '/api/staff/logout') return logout(request);
  if (method === 'GET' && url.pathname === '/api/staff/me') return me(request, env);

  return null;
}
