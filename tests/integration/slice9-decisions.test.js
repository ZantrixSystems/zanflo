import { beforeEach, describe, expect, it } from 'vitest';
import { createTestPool, resetTestData } from '../helpers/db.js';
import {
  createApplicantFixture,
  createApplicationFixture,
  createStaffFixture,
  createTenantFixture,
} from '../helpers/fixtures.js';
import { fetchWorker, getCookie, readJson } from '../helpers/requests.js';

async function loginStaff(tenantSlug, identifier, password) {
  const response = await fetchWorker('https://example.test/api/staff/login', {
    method: 'POST',
    host: `${tenantSlug}.zanflo.com`,
    body: { identifier, password },
  });
  return getCookie(response, 'session');
}

async function loginApplicant(tenantSlug, email, password) {
  const response = await fetchWorker('https://example.test/api/applicant/login', {
    method: 'POST',
    host: `${tenantSlug}.zanflo.com`,
    body: { email, password },
  });
  return getCookie(response, 'applicant_session');
}

describe('slice 9 - decisions', () => {
  beforeEach(async () => {
    await resetTestData();
  });

  it('request-information changes state correctly', async () => {
    const tenant = await createTenantFixture({ slug: 'test-request-info' });
    const officer = await createStaffFixture({ tenantId: tenant.id, role: 'officer' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const application = await createApplicationFixture({ tenantId: tenant.id, applicantAccountId: applicant.id, status: 'submitted' });
    const sessionCookie = await loginStaff(tenant.slug, officer.email, officer.password);

    const response = await fetchWorker(`https://example.test/api/admin/applications/${application.id}/request-information`, {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      cookie: sessionCookie,
      body: { notes: 'Please upload your missing document.' },
    });

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.status).toBe('awaiting_information');
  });

  it('applicant can respond only to own tenant application', async () => {
    const tenantA = await createTenantFixture({ slug: 'test-applicant-response-a' });
    const tenantB = await createTenantFixture({ slug: 'test-applicant-response-b' });
    const officer = await createStaffFixture({ tenantId: tenantA.id, role: 'officer' });
    const applicantA = await createApplicantFixture({ tenantId: tenantA.id });
    const applicantB = await createApplicantFixture({ tenantId: tenantB.id });
    const appA = await createApplicationFixture({ tenantId: tenantA.id, applicantAccountId: applicantA.id, status: 'submitted' });
    const appB = await createApplicationFixture({ tenantId: tenantB.id, applicantAccountId: applicantB.id, status: 'submitted' });
    const staffCookie = await loginStaff(tenantA.slug, officer.email, officer.password);

    await fetchWorker(`https://example.test/api/admin/applications/${appA.id}/request-information`, {
      method: 'POST',
      host: `${tenantA.slug}.zanflo.com`,
      cookie: staffCookie,
      body: { notes: 'Need more information.' },
    });

    const applicantCookie = await loginApplicant(tenantA.slug, applicantA.email, applicantA.password);
    const updateResponse = await fetchWorker(`https://example.test/api/applications/${appA.id}`, {
      method: 'PUT',
      host: `${tenantA.slug}.zanflo.com`,
      cookie: applicantCookie,
      body: { premises_description: 'Updated after information request' },
    });
    expect(updateResponse.status).toBe(200);

    const otherTenantResponse = await fetchWorker(`https://example.test/api/applications/${appB.id}`, {
      method: 'PUT',
      host: `${tenantA.slug}.zanflo.com`,
      cookie: applicantCookie,
      body: { premises_description: 'Should not work' },
    });
    expect(otherTenantResponse.status).toBe(404);
  });

  it('approve writes decision row and audit', async () => {
    const tenant = await createTenantFixture({ slug: 'test-approve' });
    const manager = await createStaffFixture({ tenantId: tenant.id, role: 'manager' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const application = await createApplicationFixture({ tenantId: tenant.id, applicantAccountId: applicant.id, status: 'submitted' });
    const sessionCookie = await loginStaff(tenant.slug, manager.email, manager.password);

    const response = await fetchWorker(`https://example.test/api/admin/applications/${application.id}/decision`, {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      cookie: sessionCookie,
      body: { decision: 'approve', notes: 'Approved for issue.' },
    });

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.status).toBe('approved');

    const pool = createTestPool();
    const client = await pool.connect();
    try {
      const decisions = await client.query(`
        SELECT decision_type
        FROM decisions
        WHERE tenant_id = $1 AND application_id = $2
      `, [tenant.id, application.id]);
      expect(decisions.rows).toHaveLength(1);
      expect(decisions.rows[0].decision_type).toBe('approve');

      const audit = await client.query(`
        SELECT action
        FROM audit_logs
        WHERE tenant_id = $1
          AND actor_id = $2
          AND record_id = $3
          AND action = 'application.approved'
      `, [tenant.id, manager.id, application.id]);
      expect(audit.rows).toHaveLength(1);
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('invalid transition returns 409', async () => {
    const tenant = await createTenantFixture({ slug: 'test-invalid-transition' });
    const officer = await createStaffFixture({ tenantId: tenant.id, role: 'officer' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const application = await createApplicationFixture({ tenantId: tenant.id, applicantAccountId: applicant.id, status: 'submitted' });
    const sessionCookie = await loginStaff(tenant.slug, officer.email, officer.password);

    await fetchWorker(`https://example.test/api/admin/applications/${application.id}/request-information`, {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      cookie: sessionCookie,
      body: { notes: 'Need extra info' },
    });

    const response = await fetchWorker(`https://example.test/api/admin/applications/${application.id}/decision`, {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      cookie: sessionCookie,
      body: { decision: 'refuse', notes: 'Trying too early' },
    });

    expect(response.status).toBe(409);
  });
});
