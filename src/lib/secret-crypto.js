const SECRET_SCHEME = 'aes_gcm_256_v1';

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normaliseSecretKey(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

async function getSecretKey(env) {
  const rawKey = normaliseSecretKey(env.SECRET_ENCRYPTION_KEY);
  if (!rawKey) {
    throw new Error('SECRET_ENCRYPTION_KEY is required to save client secrets.');
  }

  let keyBytes;
  try {
    keyBytes = fromBase64(rawKey);
  } catch {
    throw new Error('SECRET_ENCRYPTION_KEY must be base64 encoded 32 byte key material.');
  }

  if (keyBytes.byteLength !== 32) {
    throw new Error('SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export function hasSecretEncryptionKey(env) {
  return Boolean(normaliseSecretKey(env.SECRET_ENCRYPTION_KEY));
}

export async function encryptTenantSecret(env, plaintext, context) {
  if (typeof plaintext !== 'string' || !plaintext.trim()) {
    return {
      ciphertext: null,
      iv: null,
      scheme: null,
    };
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getSecretKey(env);
  const aad = new TextEncoder().encode(JSON.stringify(context));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    key,
    new TextEncoder().encode(plaintext.trim())
  );

  return {
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    iv: toBase64(iv),
    scheme: SECRET_SCHEME,
  };
}

export async function decryptTenantSecret(env, row, context) {
  if (!row?.oidc_client_secret_ciphertext || !row?.oidc_client_secret_iv) return null;
  if (row.oidc_client_secret_scheme !== SECRET_SCHEME) {
    throw new Error('Unsupported tenant secret encryption scheme.');
  }

  const key = await getSecretKey(env);
  const aad = new TextEncoder().encode(JSON.stringify(context));
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(row.oidc_client_secret_iv),
      additionalData: aad,
    },
    key,
    fromBase64(row.oidc_client_secret_ciphertext)
  );

  return new TextDecoder().decode(plaintext);
}
