import { beforeEach, describe, expect, it } from 'vitest';
import { createTestPool, resetTestData } from '../helpers/db.js';
import {
  createApplicantFixture,
  createApplicationFixture,
  createPremisesFixture,
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

describe('slice 8 - admin applications', () => {
  beforeEach(async () => {
    await resetTestData();
  });

  it('staff queue only returns current tenant records', async () => {
    const tenantA = await createTenantFixture({ slug: 'test-admin-queue-a' });
    const tenantB = await createTenantFixture({ slug: 'test-admin-queue-b' });
    const officer = await createStaffFixture({ tenantId: tenantA.id, role: 'officer' });
    const applicantA = await createApplicantFixture({ tenantId: tenantA.id });
    const applicantB = await createApplicantFixture({ tenantId: tenantB.id });
    await createApplicationFixture({ tenantId: tenantA.id, applicantAccountId: applicantA.id, status: 'submitted' });
    await createApplicationFixture({ tenantId: tenantB.id, applicantAccountId: applicantB.id, status: 'submitted' });

    const sessionCookie = await loginStaff(tenantA.slug, officer.email, officer.password);

    const response = await fetchWorker('https://example.test/api/admin/applications', {
      method: 'GET',
      host: `${tenantA.slug}.zanflo.com`,
      cookie: sessionCookie,
    });

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.applications).toHaveLength(1);
    expect(json.applications[0].applicant_email).toBe(applicantA.email);
  });

  it('applicant cannot access staff APIs', async () => {
    const tenant = await createTenantFixture({ slug: 'test-admin-applicant-block' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });

    const loginResponse = await fetchWorker('https://example.test/api/applicant/login', {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      body: {
        email: applicant.email,
        password: applicant.password,
      },
    });

    const cookie = getCookie(loginResponse, 'applicant_session');
    const response = await fetchWorker('https://example.test/api/admin/applications', {
      method: 'GET',
      host: `${tenant.slug}.zanflo.com`,
      cookie,
    });

    expect(response.status).toBe(403);
  });

  it('tenant_admin cannot access staff review APIs', async () => {
    const tenant = await createTenantFixture({ slug: 'test-admin-queue-tenant-admin' });
    const tenantAdmin = await createStaffFixture({ tenantId: tenant.id, role: 'tenant_admin' });

    const login = await fetchWorker('https://example.test/api/staff/login', {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      body: { identifier: tenantAdmin.email, password: tenantAdmin.password },
    });
    const cookie = getCookie(login, 'session');

    const response = await fetchWorker('https://example.test/api/admin/applications', {
      method: 'GET',
      host: `${tenant.slug}.zanflo.com`,
      cookie,
    });

    expect(response.status).toBe(403);
  });

  it('officer cannot steal an application assigned to another officer', async () => {
    const tenant = await createTenantFixture({ slug: 'test-admin-queue-reassign' });
    const officerOne = await createStaffFixture({ tenantId: tenant.id, role: 'officer', email: 'queue-officer-one@test-zanflo.test' });
    const officerTwo = await createStaffFixture({ tenantId: tenant.id, role: 'officer', email: 'queue-officer-two@test-zanflo.test' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const application = await createApplicationFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      status: 'under_review',
      assignedUserId: officerOne.id,
      assignedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
    });

    const login = await fetchWorker('https://example.test/api/staff/login', {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      body: { identifier: officerTwo.email, password: officerTwo.password },
    });
    const cookie = getCookie(login, 'session');

    const response = await fetchWorker(`https://example.test/api/admin/applications/${application.id}/assign`, {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      cookie,
      body: { assigned_user_id: officerTwo.id },
    });

    expect(response.status).toBe(403);
  });

  it('assignment mutation writes audit', async () => {
    const tenant = await createTenantFixture({ slug: 'test-admin-assign' });
    const manager = await createStaffFixture({ tenantId: tenant.id, role: 'manager' });
    const officer = await createStaffFixture({ tenantId: tenant.id, role: 'officer' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const application = await createApplicationFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      status: 'submitted',
    });

    const sessionCookie = await loginStaff(tenant.slug, manager.email, manager.password);

    const response = await fetchWorker(`https://example.test/api/admin/applications/${application.id}/assign`, {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      cookie: sessionCookie,
      body: {
        assigned_user_id: officer.id,
      },
    });

    expect(response.status).toBe(200);

    const pool = createTestPool();
    const client = await pool.connect();
    try {
      const audit = await client.query(`
        SELECT action
        FROM audit_logs
        WHERE tenant_id = $1
          AND actor_id = $2
          AND record_id = $3
          AND action = 'application.assigned'
      `, [tenant.id, manager.id, application.id]);
      expect(audit.rows).toHaveLength(1);
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('staff application detail returns linked premises context for the same tenant only', async () => {
    const tenant = await createTenantFixture({ slug: 'test-admin-premises-detail' });
    const officer = await createStaffFixture({ tenantId: tenant.id, role: 'officer' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });
    const premises = await createPremisesFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      premisesName: 'River View Venue',
      addressLine1: '10 High Street',
      townOrCity: 'River Town',
      postcode: 'RV1 2BB',
      premisesDescription: 'Events space',
    });
    const application = await createApplicationFixture({
      tenantId: tenant.id,
      applicantAccountId: applicant.id,
      premisesId: premises.id,
      status: 'submitted',
    });

    const sessionCookie = await loginStaff(tenant.slug, officer.email, officer.password);
    const response = await fetchWorker(`https://example.test/api/admin/applications/${application.id}`, {
      method: 'GET',
      host: `${tenant.slug}.zanflo.com`,
      cookie: sessionCookie,
    });

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.application.premises_id).toBe(premises.id);
    expect(json.application.linked_premises_name).toBe('River View Venue');
    expect(json.application.address_line_1).toBe('10 High Street');
  });
});
