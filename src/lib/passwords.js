// Password hashing using PBKDF2 via Web Crypto API.
// Works natively in Cloudflare Workers and Node 18+.

const ITERATIONS = 100_000;
const SALT_BYTES = 16;

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function deriveKey(password, salt, iterations = ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(password, salt);
  return `pbkdf2:${ITERATIONS}:${bufToHex(salt)}:${bufToHex(key)}`;
}

export async function verifyPassword(password, stored) {
  const parts = stored.split(':');
  if (parts.length !== 4) return false;
  const [, iterations, saltHex, hashHex] = parts;
  const key = await deriveKey(password, hexToBuf(saltHex), parseInt(iterations));
  return bufToHex(key) === hashHex;
}
