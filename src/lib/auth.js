// Auth middleware helper.
// Call requireAuth(request, env) in any protected route handler.
// Returns the session payload or null if not authenticated.

import { getCookieValue, verifySession } from './session.js';

export async function requireAuth(request, env) {
  const token = getCookieValue(request, 'session');
  if (!token) return null;
  return verifySession(token, env.JWT_SECRET);
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Not authenticated' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
