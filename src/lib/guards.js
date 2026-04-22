import { getApplicantSession } from './applicant-session.js';
import { getDb } from '../db/client.js';
import { isTenantHost } from './request-context.js';
import { getCookieValue, verifySession } from './session.js';

export async function requireApplicant(request, env) {
  return getApplicantSession(request, env.JWT_SECRET);
}

export async function requireStaff(request, env) {
  const token = getCookieValue(request, 'session');
  if (!token) return null;
  const session = await verifySession(token, env.JWT_SECRET);
  if (!session) return null;
  if (!session.user_id || !session.tenant_id || !session.role) return null;
  return session;
}

export function requireTenantRole(session, ...roles) {
  if (!session?.role) return false;
  return roles.includes(session.role);
}

// Load the permission set for a session that has a custom role assigned.
// Returns an array of permission keys, or null if no custom role is set.
async function loadCustomPermissions(session, env) {
  if (!session.custom_role_id) return null;
  const sql = getDb(env);
  const rows = await sql`
    SELECT permission_key
    FROM custom_role_permissions
    WHERE role_id = ${session.custom_role_id}
      AND role_id IN (
        SELECT id FROM custom_roles WHERE tenant_id = ${session.tenant_id}
      )
  `;
  return rows.map((r) => r.permission_key);
}

export async function requireTenantStaff(request, env, ...roles) {
  if (!isTenantHost(request)) return null;
  const session = await requireStaff(request, env);
  if (!session) return null;
  if (roles.length > 0 && !requireTenantRole(session, ...roles)) return null;
  return session;
}

// Check whether a session has a given permission.
// Built-in tenant_admin always passes — they have full access.
// Other built-in roles (manager, officer) do NOT pass permission checks by default;
// they must be assigned a custom role that grants the permission, OR the route must
// use requireTenantStaff with a role list instead (existing behaviour, unchanged).
// This function is used for fine-grained gates layered on top of role checks.
export function hasPermission(session, permission) {
  if (session?.role === 'tenant_admin') return true;
  if (!session?.permissions) return false;
  return session.permissions.includes(permission);
}

// Extended version that loads custom permissions from DB and attaches them.
// Use this in route handlers that need permission-level checks.
export async function requireTenantStaffWithPermissions(request, env, ...roles) {
  if (!isTenantHost(request)) return null;
  const session = await requireStaff(request, env);
  if (!session) return null;
  if (roles.length > 0 && !requireTenantRole(session, ...roles)) return null;

  // Load and attach permissions if a custom role is assigned
  const permissions = await loadCustomPermissions(session, env);
  if (permissions !== null) {
    session.permissions = permissions;
  }

  return session;
}

export async function requirePlatformAdmin(request, env) {
  const token = getCookieValue(request, 'session');
  if (!token) return null;
  const session = await verifySession(token, env.JWT_SECRET);
  if (!session) return null;
  if (!session.is_platform_admin) return null;
  return session;
}
