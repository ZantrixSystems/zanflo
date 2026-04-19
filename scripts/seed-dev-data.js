// Dev seed: two tenants, each with admin + 2 officers + 2 applicants + 2 premises each.
// Run: node scripts/seed-dev-data.js

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDevVars() {
  const devVarsPath = join(__dirname, '../.dev.vars');
  try {
    const contents = readFileSync(devVarsPath, 'utf8');
    for (const line of contents.split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
  } catch {
    console.error('ERROR: .dev.vars not found.');
    process.exit(1);
  }
}

loadDevVars();
const connectionString = process.env.DATABASE_URL;
if (!connectionString) { console.error('ERROR: DATABASE_URL not set'); process.exit(1); }

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256);
  return `pbkdf2:${ITERATIONS}:${bufToHex(salt)}:${bufToHex(new Uint8Array(bits))}`;
}

const PASSWORD = 'Password123';

const TENANTS = [
  { name: 'Riverside Council', slug: 'riverside', email_domain: 'riverside.gov.uk' },
  { name: 'Northfield Council', slug: 'northfield', email_domain: 'northfield.gov.uk' },
];

async function run() {
  const sql = neon(connectionString);
  const hash = await hashPassword(PASSWORD);
  console.log('\nPassword hash ready. Seeding...\n');

  // Platform admin
  const [platformAdmin] = await sql`
    INSERT INTO users (email, password_hash, full_name, is_platform_admin)
    VALUES ('admin@platform.internal', ${hash}, 'Platform Admin', true)
    ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id, email
  `;
  console.log(`Platform admin: ${platformAdmin.email}`);

  for (const t of TENANTS) {
    // Tenant
    const [tenant] = await sql`
      INSERT INTO tenants (name, slug, subdomain, status, activated_at)
      VALUES (${t.name}, ${t.slug}, ${t.slug}, 'active', NOW())
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, slug
    `;
    await sql`INSERT INTO tenant_limits (tenant_id, max_staff_users, max_applications) VALUES (${tenant.id}, 100, 10000) ON CONFLICT DO NOTHING`;
    await sql`
      INSERT INTO tenant_settings (tenant_id, council_display_name, support_contact_name, support_email, welcome_text, public_homepage_text, contact_us_text)
      VALUES (${tenant.id}, ${t.name}, 'Licensing Team', ${'licensing@' + t.email_domain}, ${`Welcome to ${t.name}'s licensing service.`}, 'Apply for a premises licence online.', 'Contact the licensing team for help.')
      ON CONFLICT DO NOTHING
    `;
    await sql`INSERT INTO tenant_sso_configs (tenant_id) VALUES (${tenant.id}) ON CONFLICT DO NOTHING`;

    // Enable application types
    const appTypes = await sql`SELECT id FROM application_types WHERE is_active = true`;
    for (const at of appTypes) {
      await sql`INSERT INTO tenant_enabled_application_types (tenant_id, application_type_id) VALUES (${tenant.id}, ${at.id}) ON CONFLICT DO NOTHING`;
    }

    console.log(`\nTenant: ${tenant.name} (${tenant.slug})`);

    // Tenant admin
    const [tadmin] = await sql`
      INSERT INTO users (email, password_hash, full_name, is_platform_admin)
      VALUES (${'admin@' + t.email_domain}, ${hash}, ${t.name + ' Admin'}, false)
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id, email
    `;
    await sql`INSERT INTO memberships (tenant_id, user_id, role) VALUES (${tenant.id}, ${tadmin.id}, 'tenant_admin') ON CONFLICT DO NOTHING`;
    console.log(`  Tenant admin: ${tadmin.email}`);

    // Officers
    for (let i = 1; i <= 2; i++) {
      const email = `officer${i}@${t.email_domain}`;
      const [officer] = await sql`
        INSERT INTO users (email, password_hash, full_name, is_platform_admin)
        VALUES (${email}, ${hash}, ${'Officer ' + i + ' (' + t.name + ')'}, false)
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id, email
      `;
      await sql`INSERT INTO memberships (tenant_id, user_id, role) VALUES (${tenant.id}, ${officer.id}, 'officer') ON CONFLICT DO NOTHING`;
      console.log(`  Officer ${i}: ${officer.email}`);
    }

    // Applicants + premises
    const applicantData = [
      { name: 'Alice Smith',  email: `alice@${t.slug}-residents.test` },
      { name: 'Bob Jones',    email: `bob@${t.slug}-residents.test` },
    ];
    const premisesData = [
      [
        { name: 'The Red Lion',   addr1: '12 High Street',   postcode: 'EC1A 1BB' },
        { name: 'Corner Cafe',    addr1: '4 Market Place',    postcode: 'EC1A 2CC' },
      ],
      [
        { name: 'The Blue Bell',  addr1: '88 Station Road',  postcode: 'N1 5AA' },
        { name: 'Sunset Lounge',  addr1: '22 Park Avenue',   postcode: 'N1 6BB' },
      ],
    ];

    for (let i = 0; i < applicantData.length; i++) {
      const a = applicantData[i];
      const [applicant] = await sql`
        INSERT INTO applicant_accounts (tenant_id, email, password_hash, full_name)
        VALUES (${tenant.id}, ${a.email}, ${hash}, ${a.name})
        ON CONFLICT (tenant_id, email) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id, email
      `;
      console.log(`  Applicant ${i + 1}: ${applicant.email}`);

      for (const p of premisesData[i]) {
        await sql`
          INSERT INTO premises (tenant_id, applicant_account_id, premises_name, address_line_1, postcode)
          VALUES (${tenant.id}, ${applicant.id}, ${p.name}, ${p.addr1}, ${p.postcode})
          ON CONFLICT DO NOTHING
        `;
        console.log(`    Premises: ${p.name}, ${p.addr1}`);
      }
    }
  }

  console.log('\n--- CREDENTIALS (all passwords: Password123) ---\n');
  console.log('PLATFORM ADMIN');
  console.log('  admin@platform.internal  /  Password123\n');
  for (const t of TENANTS) {
    console.log(`${t.name.toUpperCase()}`);
    console.log(`  Tenant Admin:  admin@${t.email_domain}  /  Password123`);
    console.log(`  Officer 1:     officer1@${t.email_domain}  /  Password123`);
    console.log(`  Officer 2:     officer2@${t.email_domain}  /  Password123`);
    console.log(`  Applicant 1:   alice@${t.slug}-residents.test  /  Password123`);
    console.log(`  Applicant 2:   bob@${t.slug}-residents.test  /  Password123`);
    console.log('');
  }
}

run().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
