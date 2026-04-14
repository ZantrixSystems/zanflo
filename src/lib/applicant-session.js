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
 *
 * Same-origin deployment (Worker serves both API and frontend) means:
 * - SameSite=Lax is correct and sufficient
 * - Secure is always set (Workers run on HTTPS)
 * - No cross-origin cookie gymnastics needed
 */

import { signSession, verifySession, getCookieValue } from './session.js';

const COOKIE_NAME = 'applicant_session';
const MAX_AGE = 60 * 60 * 8; // 8 hours

export async function signApplicantSession(payload, secret) {
  return signSession(payload, secret);
}

export async function verifyApplicantSession(token, secret) {
  return verifySession(token, secret);
}

export function buildApplicantCookie(token) {
  return [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${MAX_AGE}`,
    'Secure',
  ].join('; ');
}

export function clearApplicantCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure`;
}

export async function getApplicantSession(request, secret) {
  const token = getCookieValue(request, COOKIE_NAME);
  if (!token) return null;
  return verifyApplicantSession(token, secret);
}
