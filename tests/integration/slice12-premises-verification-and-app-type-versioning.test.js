/**
 * Slice 12 — Premises verification and application type versioning.
 *
 * Covers:
 *   - Applicant submit-verification state machine
 *   - Officer verification decisions (verify / refuse / more info)
 *   - Permission boundaries: non-staff cannot call staff endpoints
 *   - Applications blocked against unverified premises
 *   - Applications allowed against verified premises
 *   - Retired application type versions block new submissions
 *   - Historical applications retain their original application_type_version_id
 *   - Tenant isolation: officer from tenant A cannot see tenant B premises
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createTestPool, resetTestData } from '../helpers/db.js';
import {
  createApplicantFixture,
  createApplicationFixture,
  createApplicationTypeVersionFixture,
  createPremisesFixture,
  createStaffFixture,
  createTenantFixture,
} from '../helpers/fixtures.js';
import { fetchWorker, getCookie, readJson } from '../helpers/requests.js';

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function loginApplicant(tenantSlug, email, password) {
  const response = await fetchWorker('https://example.test/api/applicant/login', {
    method: 'POST',
    host: `${tenantSlug}.zanflo.com`,
    body: { email, password },
  });
  return getCookie(response, 'applicant_session');
}

async function loginStaff(tenantSlug, email, password) {
  const response = await fetchWorker('https://example.test/api/staff/login', {
    method: 'POST',
    host: `${tenantSlug}.zanflo.com`,
    body: { identifier: email, password },
  });
  return getCookie(response, 'session');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('slice 12 - premises verification', () => {
  beforeEach(async () => {
    await resetTestData();
  });

  // -------------------------------------------------------------------------
  // 1. Applicant submit-verification state machine
  // -------------------------------------------------------------------------

  it('applicant can submit unverified premises for verification', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-submit-01' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'unverified',
    });

    const cookie = await loginApplicant(tenant.slug, applicant.email, applicant.password);

    const response = await fetchWorker(
      `https://example.test/api/premises/${premises.id}/submit-verification`,
      { method: 'POST', host: `${tenant.slug}.zanflo.com`, cookie },
    );

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.verification_state).toBe('pending_verification');
  });

  it('applicant can resubmit after more_information_required', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-resubmit-01' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'more_information_required',
    });

    const cookie = await loginApplicant(tenant.slug, applicant.email, applicant.password);

    const response = await fetchWorker(
      `https://example.test/api/premises/${premises.id}/submit-verification`,
      { method: 'POST', host: `${tenant.slug}.zanflo.com`, cookie },
    );

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.verification_state).toBe('pending_verification');
  });

  it('applicant cannot submit already pending premises', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-double-submit' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'pending_verification',
    });

    const cookie = await loginApplicant(tenant.slug, applicant.email, applicant.password);

    const response = await fetchWorker(
      `https://example.test/api/premises/${premises.id}/submit-verification`,
      { method: 'POST', host: `${tenant.slug}.zanflo.com`, cookie },
    );

    expect(response.status).toBe(409);
  });

  it('applicant cannot submit verified premises again', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-resubmit-verified' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'verified',
    });

    const cookie = await loginApplicant(tenant.slug, applicant.email, applicant.password);

    const response = await fetchWorker(
      `https://example.test/api/premises/${premises.id}/submit-verification`,
      { method: 'POST', host: `${tenant.slug}.zanflo.com`, cookie },
    );

    expect(response.status).toBe(409);
  });

  it('unauthenticated request cannot submit for verification', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-unauth' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
    });

    const response = await fetchWorker(
      `https://example.test/api/premises/${premises.id}/submit-verification`,
      { method: 'POST', host: `${tenant.slug}.zanflo.com` },
    );

    expect(response.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 2. Officer verification decisions
  // -------------------------------------------------------------------------

  it('officer can verify a pending premises', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-verify-01' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const officer = await createStaffFixture({ tenantId: tenant.id, role: 'officer' });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'pending_verification',
    });

    const staffCookie = await loginStaff(tenant.slug, officer.email, officer.password);

    const response = await fetchWorker(
      `https://example.test/api/admin/premises-verifications/${premises.id}/decision`,
      {
        method: 'POST',
        host: `${tenant.slug}.zanflo.com`,
        cookie: staffCookie,
        body: { decision: 'verified', notes: 'Confirmed on site visit.' },
      },
    );

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.decision).toBe('verified');

    // Confirm the state was persisted
    const pool = createTestPool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT verification_state FROM premises WHERE id = $1`,
        [premises.id],
      );
      expect(result.rows[0].verification_state).toBe('verified');

      // And a domain event was written
      const events = await client.query(
        `SELECT event_type FROM premises_verification_events WHERE premises_id = $1 ORDER BY created_at DESC`,
        [premises.id],
      );
      expect(events.rows[0].event_type).toBe('verified');
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('officer can request more information from a pending premises', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-moreinfo-01' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const officer = await createStaffFixture({ tenantId: tenant.id, role: 'officer' });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'pending_verification',
    });

    const staffCookie = await loginStaff(tenant.slug, officer.email, officer.password);

    const response = await fetchWorker(
      `https://example.test/api/admin/premises-verifications/${premises.id}/decision`,
      {
        method: 'POST',
        host: `${tenant.slug}.zanflo.com`,
        cookie: staffCookie,
        body: { decision: 'more_information_required', notes: 'Please provide proof of lease.' },
      },
    );

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.decision).toBe('more_information_required');

    const pool = createTestPool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT verification_state FROM premises WHERE id = $1`,
        [premises.id],
      );
      expect(result.rows[0].verification_state).toBe('more_information_required');
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('officer can refuse a pending premises', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-refuse-01' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const officer = await createStaffFixture({ tenantId: tenant.id, role: 'officer' });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'pending_verification',
    });

    const staffCookie = await loginStaff(tenant.slug, officer.email, officer.password);

    const response = await fetchWorker(
      `https://example.test/api/admin/premises-verifications/${premises.id}/decision`,
      {
        method: 'POST',
        host: `${tenant.slug}.zanflo.com`,
        cookie: staffCookie,
        body: { decision: 'verification_refused', notes: 'Address does not match register.' },
      },
    );

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.decision).toBe('verification_refused');
  });

  it('officer cannot make a decision on premises not in pending_verification state', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-wrong-state' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const officer = await createStaffFixture({ tenantId: tenant.id, role: 'officer' });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'unverified',
    });

    const staffCookie = await loginStaff(tenant.slug, officer.email, officer.password);

    const response = await fetchWorker(
      `https://example.test/api/admin/premises-verifications/${premises.id}/decision`,
      {
        method: 'POST',
        host: `${tenant.slug}.zanflo.com`,
        cookie: staffCookie,
        body: { decision: 'verified' },
      },
    );

    expect(response.status).toBe(409);
  });

  it('officer cannot see premises from another tenant', async () => {
    const tenantA = await createTenantFixture({ slug: 'test-pv-iso-a' });
    const tenantB = await createTenantFixture({ slug: 'test-pv-iso-b' });
    const applicantB = await createApplicantFixture({ tenantId: tenantB.id });
    const officerA = await createStaffFixture({ tenantId: tenantA.id, role: 'officer' });
    const premisesB = await createPremisesFixture({
      tenantId: tenantB.id,
      applicantAccountId: applicantB.id,
      verificationState: 'pending_verification',
    });

    const staffCookie = await loginStaff(tenantA.slug, officerA.email, officerA.password);

    const response = await fetchWorker(
      `https://example.test/api/admin/premises-verifications/${premisesB.id}`,
      { method: 'GET', host: `${tenantA.slug}.zanflo.com`, cookie: staffCookie },
    );

    expect(response.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // 3. Non-staff cannot call staff verification endpoints
  // -------------------------------------------------------------------------

  it('applicant session cannot call staff verification decision endpoint', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-perm-01' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'pending_verification',
    });

    const cookie = await loginApplicant(tenant.slug, applicant.email, applicant.password);

    const response = await fetchWorker(
      `https://example.test/api/admin/premises-verifications/${premises.id}/decision`,
      {
        method: 'POST',
        host: `${tenant.slug}.zanflo.com`,
        cookie,
        body: { decision: 'verified' },
      },
    );

    // requireTenantStaff returns null → 403
    expect(response.status).toBe(403);
  });

  it('unauthenticated request cannot call staff verification list endpoint', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-unauth-list' });

    const response = await fetchWorker(
      'https://example.test/api/admin/premises-verifications',
      { method: 'GET', host: `${tenant.slug}.zanflo.com` },
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe('slice 12 - application creation gates', () => {
  beforeEach(async () => {
    await resetTestData();
  });

  // -------------------------------------------------------------------------
  // 4. Applications blocked against unverified premises
  // -------------------------------------------------------------------------

  it('applicant cannot create application against unverified premises', async () => {
    const tenant = await createTenantFixture({ slug: 'test-app-gate-unverified' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const version = await createApplicationTypeVersionFixture({ tenantId: tenant.id });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'unverified',
    });

    const cookie = await loginApplicant(tenant.slug, applicant.email, applicant.password);

    const response = await fetchWorker('https://example.test/api/applications', {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      cookie,
      body: {
        application_type_id: version.application_type_id,
        premises_id: premises.id,
      },
    });

    expect(response.status).toBe(409);
    const json = await readJson(response);
    expect(json.error).toMatch(/verified/i);
  });

  it('applicant cannot create application against pending_verification premises', async () => {
    const tenant = await createTenantFixture({ slug: 'test-app-gate-pending' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const version = await createApplicationTypeVersionFixture({ tenantId: tenant.id });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'pending_verification',
    });

    const cookie = await loginApplicant(tenant.slug, applicant.email, applicant.password);

    const response = await fetchWorker('https://example.test/api/applications', {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      cookie,
      body: {
        application_type_id: version.application_type_id,
        premises_id: premises.id,
      },
    });

    expect(response.status).toBe(409);
  });

  // -------------------------------------------------------------------------
  // 5. Applications allowed against verified premises
  // -------------------------------------------------------------------------

  it('applicant can create application against verified premises with published type version', async () => {
    const tenant = await createTenantFixture({ slug: 'test-app-gate-ok' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const version = await createApplicationTypeVersionFixture({ tenantId: tenant.id, publicationStatus: 'published' });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'verified',
    });

    const cookie = await loginApplicant(tenant.slug, applicant.email, applicant.password);

    const response = await fetchWorker('https://example.test/api/applications', {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      cookie,
      body: {
        application_type_id: version.application_type_id,
        premises_id: premises.id,
      },
    });

    expect(response.status).toBe(201);
    const json = await readJson(response);
    expect(json.application_type_version_id).toBe(version.id);
    expect(json.premises_id).toBe(premises.id);
  });

  it('created application snapshots the version id at creation time', async () => {
    const tenant = await createTenantFixture({ slug: 'test-app-snapshot-version' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const version = await createApplicationTypeVersionFixture({ tenantId: tenant.id, publicationStatus: 'published' });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'verified',
    });

    const cookie = await loginApplicant(tenant.slug, applicant.email, applicant.password);

    const createResponse = await fetchWorker('https://example.test/api/applications', {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      cookie,
      body: { application_type_id: version.application_type_id, premises_id: premises.id },
    });

    const created = await readJson(createResponse);
    const applicationId = created.id;

    // Now retire the version
    const pool = createTestPool();
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE application_type_versions SET publication_status = 'retired', retired_at = NOW() WHERE id = $1`,
        [version.id],
      );

      // The application still references the original version id
      const result = await client.query(
        `SELECT application_type_version_id FROM applications WHERE id = $1`,
        [applicationId],
      );
      expect(result.rows[0].application_type_version_id).toBe(version.id);
    } finally {
      client.release();
      await pool.end();
    }
  });
});

// ---------------------------------------------------------------------------
describe('slice 12 - application type versioning', () => {
  beforeEach(async () => {
    await resetTestData();
  });

  // -------------------------------------------------------------------------
  // 6. Retired type versions block new submissions
  // -------------------------------------------------------------------------

  it('applicant cannot create application when only version is retired', async () => {
    const tenant = await createTenantFixture({ slug: 'test-atv-retired-block' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const version = await createApplicationTypeVersionFixture({
      tenantId: tenant.id,
      publicationStatus: 'retired',
    });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'verified',
    });

    const cookie = await loginApplicant(tenant.slug, applicant.email, applicant.password);

    const response = await fetchWorker('https://example.test/api/applications', {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      cookie,
      body: { application_type_id: version.application_type_id, premises_id: premises.id },
    });

    // No published version → should fail at type-check or version-check
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('public application-types endpoint only returns published versions', async () => {
    const tenant = await createTenantFixture({ slug: 'test-atv-public-list' });
    await createApplicationTypeVersionFixture({ tenantId: tenant.id, publicationStatus: 'published', applicationTypeSlug: 'premises_licence', versionNumber: 1 });
    await createApplicationTypeVersionFixture({ tenantId: tenant.id, publicationStatus: 'retired', applicationTypeSlug: 'provisional_statement', versionNumber: 1 });

    const response = await fetchWorker('https://example.test/api/application-types', {
      method: 'GET',
      host: `${tenant.slug}.zanflo.com`,
    });

    expect(response.status).toBe(200);
    const json = await readJson(response);
    const slugs = json.application_types.map((t) => t.slug);
    expect(slugs).toContain('premises_licence');
    expect(slugs).not.toContain('provisional_statement');
  });

  it('tenant admin can publish an application type', async () => {
    const tenant = await createTenantFixture({ slug: 'test-atv-publish' });
    const tenantAdmin = await createStaffFixture({ tenantId: tenant.id, role: 'tenant_admin' });

    const pool = createTestPool();
    const client = await pool.connect();
    let applicationTypeId;
    try {
      const result = await client.query(
        `SELECT id FROM application_types WHERE slug = 'premises_licence' LIMIT 1`,
      );
      applicationTypeId = result.rows[0].id;
    } finally {
      client.release();
      await pool.end();
    }

    const staffCookie = await loginStaff(tenant.slug, tenantAdmin.email, tenantAdmin.password);

    const response = await fetchWorker(
      `https://example.test/api/admin/application-types/${applicationTypeId}/publish`,
      {
        method: 'POST',
        host: `${tenant.slug}.zanflo.com`,
        cookie: staffCookie,
        body: { review_mode: 'single_officer' },
      },
    );

    expect(response.status).toBe(201);
    const json = await readJson(response);
    expect(json.publication_status).toBe('published');
    expect(json.tenant_id).toBe(tenant.id);
  });

  it('officer cannot publish application types', async () => {
    const tenant = await createTenantFixture({ slug: 'test-atv-publish-perm' });
    const officer = await createStaffFixture({ tenantId: tenant.id, role: 'officer' });

    const pool = createTestPool();
    const client = await pool.connect();
    let applicationTypeId;
    try {
      const result = await client.query(`SELECT id FROM application_types WHERE slug = 'premises_licence' LIMIT 1`);
      applicationTypeId = result.rows[0].id;
    } finally {
      client.release();
      await pool.end();
    }

    const staffCookie = await loginStaff(tenant.slug, officer.email, officer.password);

    const response = await fetchWorker(
      `https://example.test/api/admin/application-types/${applicationTypeId}/publish`,
      {
        method: 'POST',
        host: `${tenant.slug}.zanflo.com`,
        cookie: staffCookie,
        body: {},
      },
    );

    expect(response.status).toBe(403);
  });

  it('tenant admin can retire a published version', async () => {
    const tenant = await createTenantFixture({ slug: 'test-atv-retire' });
    const tenantAdmin = await createStaffFixture({ tenantId: tenant.id, role: 'tenant_admin' });
    const version = await createApplicationTypeVersionFixture({
      tenantId: tenant.id,
      publicationStatus: 'published',
    });

    const staffCookie = await loginStaff(tenant.slug, tenantAdmin.email, tenantAdmin.password);

    const response = await fetchWorker(
      `https://example.test/api/admin/application-types/${version.id}/retire`,
      {
        method: 'POST',
        host: `${tenant.slug}.zanflo.com`,
        cookie: staffCookie,
      },
    );

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.retired).toBe(true);
  });

  it('tenant admin cannot retire a version from another tenant', async () => {
    const tenantA = await createTenantFixture({ slug: 'test-atv-retire-iso-a' });
    const tenantB = await createTenantFixture({ slug: 'test-atv-retire-iso-b' });
    const adminA = await createStaffFixture({ tenantId: tenantA.id, role: 'tenant_admin' });
    const versionB = await createApplicationTypeVersionFixture({
      tenantId: tenantB.id,
      publicationStatus: 'published',
    });

    const staffCookie = await loginStaff(tenantA.slug, adminA.email, adminA.password);

    const response = await fetchWorker(
      `https://example.test/api/admin/application-types/${versionB.id}/retire`,
      {
        method: 'POST',
        host: `${tenantA.slug}.zanflo.com`,
        cookie: staffCookie,
      },
    );

    // tenant_id scoping means the version is not found for this tenant
    expect(response.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // 7. Audit log written for verification events
  // -------------------------------------------------------------------------

  it('verifying premises writes an audit log entry', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-audit' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const officer = await createStaffFixture({ tenantId: tenant.id, role: 'officer' });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'pending_verification',
    });

    const staffCookie = await loginStaff(tenant.slug, officer.email, officer.password);

    await fetchWorker(
      `https://example.test/api/admin/premises-verifications/${premises.id}/decision`,
      {
        method: 'POST',
        host: `${tenant.slug}.zanflo.com`,
        cookie: staffCookie,
        body: { decision: 'verified' },
      },
    );

    const pool = createTestPool();
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT action FROM audit_logs
        WHERE tenant_id = $1
          AND record_id = $2
          AND record_type = 'premises'
        ORDER BY created_at DESC
        LIMIT 1
      `, [tenant.id, premises.id]);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].action).toBe('premises.verified');
    } finally {
      client.release();
      await pool.end();
    }
  });

  // -------------------------------------------------------------------------
  // 8. Editing verified premises resets state only when in pending
  // -------------------------------------------------------------------------

  it('editing a pending_verification premises resets state to unverified', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-edit-reset' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'pending_verification',
    });

    const cookie = await loginApplicant(tenant.slug, applicant.email, applicant.password);

    const response = await fetchWorker(`https://example.test/api/premises/${premises.id}`, {
      method: 'PUT',
      host: `${tenant.slug}.zanflo.com`,
      cookie,
      body: {
        premises_name: 'Updated Name',
        address_line_1: '2 New Street',
        postcode: 'TE2 2ST',
      },
    });

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.verification_state).toBe('unverified');
  });

  it('editing a verified premises does NOT reset state', async () => {
    const tenant = await createTenantFixture({ slug: 'test-pv-edit-no-reset' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      verificationState: 'verified',
    });

    const cookie = await loginApplicant(tenant.slug, applicant.email, applicant.password);

    const response = await fetchWorker(`https://example.test/api/premises/${premises.id}`, {
      method: 'PUT',
      host: `${tenant.slug}.zanflo.com`,
      cookie,
      body: {
        premises_name: 'Updated Name',
        address_line_1: '2 New Street',
        postcode: 'TE2 2ST',
      },
    });

    expect(response.status).toBe(200);
    const json = await readJson(response);
    // verified state is preserved — only pending is reset
    expect(json.verification_state).toBe('verified');
  });
});
