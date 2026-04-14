// JWT session using HMAC-SHA256 via Web Crypto API.
// No external packages required.

const SESSION_COOKIE = 'session';
const MAX_AGE = 60 * 60 * 24; // 24 hours

function base64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlEncodeBytes(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded);
}

async function getHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSession(payload, secret) {
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64urlEncode(JSON.stringify(payload));
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${header}.${body}`)
  );
  return `${header}.${body}.${base64urlEncodeBytes(sig)}`;
}

export async function verifySession(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const key = await getHmacKey(secret);
  const sigBytes = Uint8Array.from(base64urlDecode(sig), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(`${header}.${body}`)
  );
  if (!valid) return null;
  try {
    return JSON.parse(base64urlDecode(body));
  } catch {
    return null;
  }
}

export function buildCookie(token, isSecure) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    // Cross-origin deployments (e.g. Pages + Workers on different .dev domains)
    // require SameSite=None; Secure. On HTTP localhost, fall back to SameSite=Lax
    // because SameSite=None requires Secure and browsers reject it on plain HTTP.
    isSecure ? 'SameSite=None' : 'SameSite=Lax',
    'Path=/',
    `Max-Age=${MAX_AGE}`,
  ];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(isSecure = false) {
  const sameSite = isSecure ? 'SameSite=None' : 'SameSite=Lax';
  const secure   = isSecure ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; ${sameSite}; Path=/; Max-Age=0${secure}`;
}

export function getCookieValue(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}
