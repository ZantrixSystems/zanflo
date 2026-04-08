// Seed script — creates test tenant, user, and membership.
// Safe to run multiple times — uses ON CONFLICT DO NOTHING.
// Run: node scripts/seed.js

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Load .dev.vars
// ---------------------------------------------------------------------------
function loadDevVars() {
  const devVarsPath = join(__dirname, '../.dev.vars');
  try {
    const contents = readFileSync(devVarsPath, 'utf8');
    for (const line of contents.split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
  } catch {
    console.error('ERROR: .dev.vars not found. Create it with DATABASE_URL=...');
    process.exit(1);
  }
}

loadDevVars();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: DATABASE_URL not set in .dev.vars');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Password hashing (mirrors src/lib/passwords.js — uses Web Crypto in Node 18+)
// ---------------------------------------------------------------------------
const ITERATIONS = 100_000;
const SALT_BYTES = 16;

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return `pbkdf2:${ITERATIONS}:${bufToHex(salt)}:${bufToHex(new Uint8Array(bits))}`;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
const SEED_EMAIL    = 'admin@example.com'; // ← change this to your real email
const SEED_NAME     = 'Platform Test Admin';
const SEED_PASSWORD = 'ChangeMe123!';
const TENANT_NAME   = 'Test Council';
const TENANT_SLUG   = 'test-council';

async function run() {
  const sql = neon(connectionString);

  console.log('Hashing password...');
  const passwordHash = await hashPassword(SEED_PASSWORD);

  // Tenant
  const tenants = await sql`
    INSERT INTO tenants (name, slug)
    VALUES (${TENANT_NAME}, ${TENANT_SLUG})
    ON CONFLICT (slug) DO NOTHING
    RETURNING id
  `;

  let tenantId;
  if (tenants.length > 0) {
    tenantId = tenants[0].id;
    console.log(`  created tenant: ${TENANT_NAME} (${tenantId})`);
  } else {
    const existing = await sql`SELECT id FROM tenants WHERE slug = ${TENANT_SLUG}`;
    tenantId = existing[0].id;
    console.log(`  tenant already exists: ${TENANT_NAME} (${tenantId})`);
  }

  // User
  const users = await sql`
    INSERT INTO users (email, password_hash, full_name, is_platform_admin)
    VALUES (${SEED_EMAIL}, ${passwordHash}, ${SEED_NAME}, true)
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `;

  let userId;
  if (users.length > 0) {
    userId = users[0].id;
    console.log(`  created user: ${SEED_EMAIL} (${userId})`);
  } else {
    const existing = await sql`SELECT id FROM users WHERE email = ${SEED_EMAIL}`;
    userId = existing[0].id;
    console.log(`  user already exists: ${SEED_EMAIL} (${userId})`);
  }

  // Membership
  const memberships = await sql`
    INSERT INTO memberships (tenant_id, user_id, role)
    VALUES (${tenantId}, ${userId}, 'tenant_admin')
    ON CONFLICT (tenant_id, user_id) DO NOTHING
    RETURNING id
  `;

  if (memberships.length > 0) {
    console.log(`  created membership: tenant_admin`);
  } else {
    console.log(`  membership already exists`);
  }

  console.log('Seed complete.');
  console.log(`\nLogin with:`);
  console.log(`  email:    ${SEED_EMAIL}`);
  console.log(`  password: ${SEED_PASSWORD}`);
}

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
