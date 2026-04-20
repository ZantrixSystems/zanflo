/**
 * Dev seed: Riverside15 tenant — premise licence case model.
 *
 * Creates:
 *   - 1 tenant: Riverside15 Council
 *   - 1 tenant admin, 1 manager, 3 officers
 *   - 3 applicants with 2 premises each (6 premises total)
 *   - 1 licence section definition: Entertainment
 *   - 6 premise_licence_cases with a realistic mix of statuses
 *   - case_selected_sections linking cases to licence sections
 *   - case_events for each case (timeline entries)
 *
 * Run: node scripts/seed-riverside15.js
 * All passwords: Password123!Riverside
 *
 * NOTE: This seed uses the new premise_licence_case model (migration 0026).
 * The old applications / premises_verification_events tables are NOT seeded here.
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDevVars() {
  const path = join(__dirname, '../.dev.vars');
  try {
    const contents = readFileSync(path, 'utf8');
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
const SALT_BYTES  = 16;
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password) {
  const salt        = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits        = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256);
  return `pbkdf2:${ITERATIONS}:${bufToHex(salt)}:${bufToHex(new Uint8Array(bits))}`;
}

const PASSWORD = 'Password123!Riverside';
const SLUG     = 'riverside15';
const DOMAIN   = 'riverside15.gov.uk';

async function writeCaseEvent(sql, { tenantId, caseId, eventType, actorType, actorId, payload = {} }) {
  await sql`
    INSERT INTO case_events (tenant_id, case_id, event_type, actor_type, actor_id, payload)
    VALUES (${tenantId}, ${caseId}, ${eventType}, ${actorType}, ${actorId ?? null}, ${JSON.stringify(payload)})
  `;
}

async function run() {
  const sql  = neon(connectionString);
  const hash = await hashPassword(PASSWORD);
  console.log('\nSeeding Riverside15 (premise_licence_case model)...\n');

  // -------------------------------------------------------------------------
  // Tenant
  // -------------------------------------------------------------------------
  const [tenant] = await sql`
    INSERT INTO tenants (name, slug, subdomain, status, activated_at)
    VALUES ('Riverside15 Council', ${SLUG}, ${SLUG}, 'active', NOW())
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, name, slug
  `;
  console.log(`Tenant: ${tenant.name} [${tenant.id}]`);

  await sql`INSERT INTO tenant_limits (tenant_id, max_staff_users, max_applications) VALUES (${tenant.id}, 100, 10000) ON CONFLICT DO NOTHING`;
  await sql`
    INSERT INTO tenant_settings (tenant_id, council_display_name, support_contact_name, support_email, welcome_text, public_homepage_text, contact_us_text)
    VALUES (${tenant.id}, 'Riverside15 Council', 'Licensing Team', ${'licensing@' + DOMAIN}, 'Welcome to Riverside15 licensing.', 'Apply for your premises licence online.', 'Contact the licensing team for help.')
    ON CONFLICT DO NOTHING
  `;
  await sql`INSERT INTO tenant_sso_configs (tenant_id) VALUES (${tenant.id}) ON CONFLICT DO NOTHING`;

  // -------------------------------------------------------------------------
  // Licence section definitions
  // -------------------------------------------------------------------------
  // Premises Licence is always implied (base section — every case has it).
  // Entertainment is the first configurable section for Riverside15.

  const entertainmentFields = JSON.stringify([
    { key: 'opening_until',     label: 'What time will the premises be open until?',  type: 'text',    required: true },
    { key: 'films_after_11pm',  label: 'Will films be shown after 11pm?',              type: 'boolean', required: true },
    { key: 'live_music',        label: 'Will live music be performed?',                type: 'boolean', required: true },
    { key: 'recorded_music',    label: 'Will recorded music be played?',               type: 'boolean', required: false },
    { key: 'additional_notes',  label: 'Any additional information about entertainment activities?', type: 'textarea', required: false },
  ]);

  const lateNightFields = JSON.stringify([
    { key: 'service_end_time',  label: 'What time will late night refreshment end?',  type: 'text',    required: true },
    { key: 'outdoor_seating',   label: 'Is outdoor seating provided after 11pm?',     type: 'boolean', required: true },
    { key: 'delivery_service',  label: 'Is a hot food delivery service offered?',     type: 'boolean', required: false },
  ]);

  const [entSection] = await sql`
    INSERT INTO licence_section_definitions (tenant_id, slug, name, description, fields, is_enabled, display_order)
    VALUES (
      ${tenant.id}, 'entertainment', 'Entertainment',
      'Covers regulated entertainment activities including live music, recorded music, films, and performances.',
      ${entertainmentFields}, TRUE, 10
    )
    ON CONFLICT (tenant_id, slug) DO UPDATE SET
      name = EXCLUDED.name, fields = EXCLUDED.fields, updated_at = NOW()
    RETURNING id, slug, name
  `;
  console.log(`  Section: ${entSection.name} [${entSection.id}]`);

  const [lnrSection] = await sql`
    INSERT INTO licence_section_definitions (tenant_id, slug, name, description, fields, is_enabled, display_order)
    VALUES (
      ${tenant.id}, 'late_night_refreshment', 'Late Night Refreshment',
      'Covers the supply of hot food or hot drink between 11pm and 5am.',
      ${lateNightFields}, TRUE, 20
    )
    ON CONFLICT (tenant_id, slug) DO UPDATE SET
      name = EXCLUDED.name, fields = EXCLUDED.fields, updated_at = NOW()
    RETURNING id, slug, name
  `;
  console.log(`  Section: ${lnrSection.name} [${lnrSection.id}]`);

  // -------------------------------------------------------------------------
  // Staff
  // -------------------------------------------------------------------------
  const [tadmin] = await sql`
    INSERT INTO users (email, password_hash, full_name, is_platform_admin)
    VALUES (${'admin@' + DOMAIN}, ${hash}, 'Sarah Chen', false)
    ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id, email
  `;
  await sql`INSERT INTO memberships (tenant_id, user_id, role) VALUES (${tenant.id}, ${tadmin.id}, 'tenant_admin') ON CONFLICT DO NOTHING`;
  console.log(`  Admin:   ${tadmin.email}`);

  const [manager] = await sql`
    INSERT INTO users (email, password_hash, full_name, is_platform_admin)
    VALUES (${'manager@' + DOMAIN}, ${hash}, 'James Okafor', false)
    ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id, email
  `;
  await sql`INSERT INTO memberships (tenant_id, user_id, role) VALUES (${tenant.id}, ${manager.id}, 'manager') ON CONFLICT DO NOTHING`;
  console.log(`  Manager: ${manager.email}`);

  const officerData = [
    { email: `officer1@${DOMAIN}`, name: 'Priya Sharma' },
    { email: `officer2@${DOMAIN}`, name: 'Tom Wallace' },
    { email: `officer3@${DOMAIN}`, name: 'Aisha Patel' },
  ];
  const officers = [];
  for (const o of officerData) {
    const [u] = await sql`
      INSERT INTO users (email, password_hash, full_name, is_platform_admin)
      VALUES (${o.email}, ${hash}, ${o.name}, false)
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id, email
    `;
    await sql`INSERT INTO memberships (tenant_id, user_id, role) VALUES (${tenant.id}, ${u.id}, 'officer') ON CONFLICT DO NOTHING`;
    officers.push(u);
    console.log(`  Officer: ${u.email}`);
  }

  // -------------------------------------------------------------------------
  // Applicants + premises
  // -------------------------------------------------------------------------
  const applicantData = [
    { name: 'Marco Rossi',   email: `marco@${SLUG}-residents.test` },
    { name: 'Helen Davies',  email: `helen@${SLUG}-residents.test` },
    { name: 'Kwame Asante',  email: `kwame@${SLUG}-residents.test` },
  ];

  const premisesMatrix = [
    [
      { name: 'The Crown & Anchor', addr1: '14 Riverside Road',  city: 'Riverside',  postcode: 'RV1 1AA', desc: 'Traditional public house with beer garden' },
      { name: 'Riverside Diner',    addr1: '2 Market Street',    city: 'Riverside',  postcode: 'RV1 1BB', desc: 'Casual dining restaurant, 80 covers' },
    ],
    [
      { name: 'The Blue Note',      addr1: '55 Canal Street',    city: 'Riverside',  postcode: 'RV2 3CC', desc: 'Live music venue, capacity 200' },
      { name: 'Corner Convenience', addr1: '8 Oak Avenue',       city: 'Northside',  postcode: 'RV2 4DD', desc: 'Small convenience store' },
    ],
    [
      { name: 'Spice Garden',       addr1: '91 High Street',     city: 'Riverside',  postcode: 'RV1 2FF', desc: 'Indian restaurant, licensed premises' },
      { name: 'The Old Brewery',    addr1: '1 Brewery Lane',     city: 'Eastfield',  postcode: 'RV4 7GG', desc: 'Craft brewery and taproom' },
    ],
  ];

  // Case scenarios: realistic status mix for the officer queue
  // Each entry: [applicantIdx, premisesIdx, status, officerAssignedIdx (null=unassigned), sections]
  const caseScenarios = [
    // Marco's pub: under review with Entertainment
    [0, 0, 'under_review',          0, [entSection]],
    // Marco's diner: awaiting info (Late Night Refreshment)
    [0, 1, 'awaiting_information',  1, [lnrSection]],
    // Helen's music venue: waiting on officer (both sections)
    [1, 0, 'waiting_on_officer',    0, [entSection, lnrSection]],
    // Helen's convenience store: submitted, unassigned
    [1, 1, 'submitted',             null, [lnrSection]],
    // Kwame's restaurant: licensed (Entertainment)
    [2, 0, 'licensed',              2, [entSection]],
    // Kwame's brewery: under_consultation (both sections)
    [2, 1, 'under_consultation',    1, [entSection, lnrSection]],
  ];

  console.log('\n  Creating applicants, premises, and cases...\n');

  for (let ai = 0; ai < applicantData.length; ai++) {
    const a = applicantData[ai];
    const [applicant] = await sql`
      INSERT INTO applicant_accounts (tenant_id, email, password_hash, full_name)
      VALUES (${tenant.id}, ${a.email}, ${hash}, ${a.name})
      ON CONFLICT (tenant_id, email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id, email
    `;
    console.log(`  Applicant: ${applicant.email}`);

    for (let pi = 0; pi < premisesMatrix[ai].length; pi++) {
      const p = premisesMatrix[ai][pi];

      // Create or retrieve premises
      let [premises] = await sql`
        INSERT INTO premises (tenant_id, applicant_account_id, premises_name, address_line_1, town_or_city, postcode, premises_description, verification_state)
        VALUES (${tenant.id}, ${applicant.id}, ${p.name}, ${p.addr1}, ${p.city}, ${p.postcode}, ${p.desc}, 'verified')
        ON CONFLICT DO NOTHING
        RETURNING id, premises_name
      `;
      if (!premises) {
        [premises] = await sql`
          SELECT id, premises_name FROM premises
          WHERE tenant_id = ${tenant.id} AND applicant_account_id = ${applicant.id} AND premises_name = ${p.name}
        `;
      }
      console.log(`    Premises: ${premises.premises_name}`);

      // Find matching scenario
      const scenario = caseScenarios.find(([sAi, sPi]) => sAi === ai && sPi === pi);
      if (!scenario) continue;

      const [, , status, officerIdx, sections] = scenario;
      const assignedUserId = officerIdx !== null ? officers[officerIdx]?.id : null;

      // Check for existing case (idempotent re-seed)
      const existingCase = await sql`
        SELECT id FROM premise_licence_cases
        WHERE premises_id = ${premises.id} AND tenant_id = ${tenant.id}
        LIMIT 1
      `;
      if (existingCase.length > 0) {
        console.log(`    Case already exists — skipping`);
        continue;
      }

      const submittedAt  = status !== 'draft' ? new Date().toISOString() : null;
      const assignedAt   = assignedUserId ? new Date().toISOString() : null;
      // Stagger updated_at so the queue shows varied last-updated times
      const daysAgo      = Math.floor(Math.random() * 14);
      const updatedAt    = new Date(Date.now() - daysAgo * 86_400_000).toISOString();

      const [plc] = await sql`
        INSERT INTO premise_licence_cases (
          tenant_id, applicant_account_id, premises_id,
          premises_name, address_line_1, town_or_city, postcode, premises_description,
          status, assigned_user_id, assigned_at, submitted_at, updated_at
        )
        VALUES (
          ${tenant.id}, ${applicant.id}, ${premises.id},
          ${p.name}, ${p.addr1}, ${p.city}, ${p.postcode}, ${p.desc},
          ${status}, ${assignedUserId}, ${assignedAt}, ${submittedAt}, ${updatedAt}
        )
        RETURNING id, ref_number
      `;
      console.log(`    Case: ${status} / ${assignedUserId ? `officer${officerIdx + 1}` : 'unassigned'} [ref ${plc.ref_number}]`);

      // Seed selected sections
      for (const sec of sections) {
        const answers = {};
        if (sec.slug === 'entertainment') {
          answers.opening_until    = '01:00';
          answers.films_after_11pm = status === 'licensed' ? true : false;
          answers.live_music       = true;
          answers.recorded_music   = true;
          answers.additional_notes = '';
        }
        if (sec.slug === 'late_night_refreshment') {
          answers.service_end_time = '02:30';
          answers.outdoor_seating  = false;
          answers.delivery_service = false;
        }

        await sql`
          INSERT INTO case_selected_sections (tenant_id, case_id, section_definition_id, section_slug, answers)
          VALUES (${tenant.id}, ${plc.id}, ${sec.id}, ${sec.slug}, ${JSON.stringify(answers)})
          ON CONFLICT DO NOTHING
        `;
      }

      // Seed meaningful case_events timeline
      const actorId = applicant.id;
      const officerId = assignedUserId ?? officers[0].id;

      await writeCaseEvent(sql, {
        tenantId: tenant.id, caseId: plc.id,
        eventType: 'case_created', actorType: 'applicant', actorId,
        payload: { premises_name: p.name },
      });

      if (status !== 'draft') {
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'case_submitted', actorType: 'applicant', actorId,
        });
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'status_changed', actorType: 'applicant', actorId,
          payload: { from: 'draft', to: 'submitted' },
        });
      }

      if (assignedUserId) {
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'officer_assigned', actorType: 'officer', actorId: officerId,
          payload: { user_name: officers[officerIdx]?.full_name ?? 'Officer' },
        });
        if (status !== 'submitted') {
          await writeCaseEvent(sql, {
            tenantId: tenant.id, caseId: plc.id,
            eventType: 'status_changed', actorType: 'officer', actorId: officerId,
            payload: { from: 'submitted', to: 'under_review' },
          });
        }
      }

      if (status === 'awaiting_information') {
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'information_requested', actorType: 'officer', actorId: officerId,
          payload: { notes: 'Please provide a copy of your floor plan and fire safety certificate.' },
        });
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'status_changed', actorType: 'officer', actorId: officerId,
          payload: { from: 'under_review', to: 'awaiting_information' },
        });
      }

      if (status === 'waiting_on_officer') {
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'information_requested', actorType: 'officer', actorId: officerId,
          payload: { notes: 'We need your DPS (Designated Premises Supervisor) certificate.' },
        });
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'information_provided', actorType: 'applicant', actorId,
          payload: { notes: 'I have attached the DPS certificate as requested.' },
        });
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'status_changed', actorType: 'applicant', actorId,
          payload: { from: 'awaiting_information', to: 'waiting_on_officer' },
        });
      }

      if (status === 'under_consultation') {
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'status_changed', actorType: 'officer', actorId: officerId,
          payload: { from: 'under_review', to: 'verified', notes: 'All documentation confirmed.' },
        });
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'status_changed', actorType: 'officer', actorId: officerId,
          payload: { from: 'verified', to: 'under_consultation' },
        });
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'officer_note', actorType: 'officer', actorId: officerId,
          payload: { body: 'Consultation period started. Closing date in 28 days.' },
        });
      }

      if (status === 'licensed') {
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'decision_made', actorType: 'officer', actorId: officerId,
          payload: { decision: 'licensed', notes: 'All conditions met. Licence granted.' },
        });
        await writeCaseEvent(sql, {
          tenantId: tenant.id, caseId: plc.id,
          eventType: 'status_changed', actorType: 'officer', actorId: officerId,
          payload: { from: 'under_consultation', to: 'licensed' },
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n--- RIVERSIDE15 CREDENTIALS (password: Password123!Riverside) ---\n');
  console.log('  Tenant admin:  admin@riverside15.gov.uk');
  console.log('  Manager:       manager@riverside15.gov.uk');
  console.log('  Officer 1:     officer1@riverside15.gov.uk  (Priya Sharma)');
  console.log('  Officer 2:     officer2@riverside15.gov.uk  (Tom Wallace)');
  console.log('  Officer 3:     officer3@riverside15.gov.uk  (Aisha Patel)');
  console.log('');
  console.log('  Applicants:');
  for (const a of applicantData) console.log(`    ${a.email}`);
  console.log('');
  console.log('  Licence sections seeded: Entertainment, Late Night Refreshment');
  console.log('');
  console.log('  Case statuses seeded:');
  console.log('    under_review, awaiting_information, waiting_on_officer,');
  console.log('    submitted (unassigned), licensed, under_consultation');
  console.log('');
  console.log(`Sign in at: http://riverside15.localhost/admin  (dev)`);
}

run().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
