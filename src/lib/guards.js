import { getApplicantSession } from './applicant-session.js';
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

export async function requireTenantStaff(request, env, ...roles) {
  if (!isTenantHost(request)) return null;
  const session = await requireStaff(request, env);
  if (!session) return null;
  if (roles.length > 0 && !requireTenantRole(session, ...roles)) return null;
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
