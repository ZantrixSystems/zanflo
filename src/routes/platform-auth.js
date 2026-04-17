import { getDb } from '../db/client.js';
import { isPlatformHost } from '../lib/request-context.js';
import { requirePlatformAdmin } from '../lib/guards.js';
import { verifyPassword } from '../lib/passwords.js';
import { buildCookie, clearCookie, signSession } from '../lib/session.js';

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
  if (!isPlatformHost(request)) return error('Not found', 404);

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

  const sql = getDb(env);
  const rows = await sql`
    SELECT id, email, username, full_name, password_hash, is_platform_admin
    FROM users
    WHERE is_platform_admin = true
      AND (
        email = ${identifier.toLowerCase()}
        OR LOWER(COALESCE(username, '')) = ${identifier.toLowerCase()}
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
    is_platform_admin: true,
    tenant_id: null,
    tenant_slug: null,
    role: null,
  }, env.JWT_SECRET);

  return json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      is_platform_admin: true,
    },
  }, 200, {
    'Set-Cookie': buildCookie(token),
  });
}

async function logout(request) {
  if (!isPlatformHost(request)) return error('Not found', 404);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearCookie(),
    },
  });
}

async function me(request, env) {
  if (!isPlatformHost(request)) return error('Not found', 404);

  const session = await requirePlatformAdmin(request, env);
  if (!session) return error('Not authenticated', 401);

  return json({ session });
}

export async function handlePlatformAuthRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'POST' && url.pathname === '/api/platform/login') return login(request, env);
  if (method === 'POST' && url.pathname === '/api/platform/logout') return logout(request);
  if (method === 'GET' && url.pathname === '/api/platform/me') return me(request, env);

  return null;
}
