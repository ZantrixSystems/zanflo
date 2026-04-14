/**
 * Applicant session helpers.
 *
 * Applicants use a separate cookie from staff users (session vs applicant_session).
 * This prevents any accidental cross-context session reuse and makes the
 * auth boundary explicit and auditable.
 *
 * Payload shape:
 * {
 *   applicant_account_id: string (UUID)
 *   tenant_id:            string (UUID)
 *   email:                string
 *   full_name:            string
 * }
 */

import { signSession, verifySession, getCookieValue } from './session.js';

const COOKIE_NAME = 'applicant_session';
const MAX_AGE = 60 * 60 * 8; // 8 hours — applicant sessions are shorter than staff

export async function signApplicantSession(payload, secret) {
  return signSession(payload, secret);
}

export async function verifyApplicantSession(token, secret) {
  return verifySession(token, secret);
}

export function buildApplicantCookie(token, isSecure) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    // SameSite=None required when frontend and backend are on different origins
    // (e.g. *.pages.dev and *.workers.dev). SameSite=None requires Secure.
    // On plain HTTP localhost, fall back to SameSite=Lax.
    isSecure ? 'SameSite=None' : 'SameSite=Lax',
    'Path=/',
    `Max-Age=${MAX_AGE}`,
  ];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

export function clearApplicantCookie(isSecure = false) {
  const sameSite = isSecure ? 'SameSite=None' : 'SameSite=Lax';
  const secure   = isSecure ? '; Secure' : '';
  return `${COOKIE_NAME}=; HttpOnly; ${sameSite}; Path=/; Max-Age=0${secure}`;
}

/**
 * Extract and verify an applicant session from the request.
 * Returns the session payload or null.
 */
export async function getApplicantSession(request, secret) {
  const token = getCookieValue(request, COOKIE_NAME);
  if (!token) return null;
  return verifyApplicantSession(token, secret);
}
