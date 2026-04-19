import { beforeEach, describe, expect, it } from 'vitest';
import { createTestPool, resetTestData } from '../helpers/db.js';
import { createApplicantFixture, createStaffFixture, createTenantFixture } from '../helpers/fixtures.js';
import { fetchWorker, getCookie, readJson } from '../helpers/requests.js';

async function loginPlatform(identifier, password) {
  const response = await fetchWorker('https://example.test/api/platform/login', {
    method: 'POST',
    host: 'platform.zanflo.com',
    body: { identifier, password },
  });
  return getCookie(response, 'session');
}

describe('slice 11 - platform manual onboarding', () => {
  beforeEach(async () => {
    await resetTestData();
  });

  it('only platform admin can access platform onboarding routes', async () => {
    const tenant = await createTenantFixture({ slug: 'test-platform-access' });
    const officer = await createStaffFixture({ tenantId: tenant.id, role: 'officer' });

    const staffLogin = await fetchWorker('https://example.test/api/staff/login', {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      body: { identifier: officer.email, password: officer.password },
    });
    const staffCookie = getCookie(staffLogin, 'session');

    const response = await fetchWorker('https://example.test/api/platform/tenants', {
      method: 'GET',
      host: 'platform.zanflo.com',
      cookie: staffCookie,
    });

    expect(response.status).toBe(403);
  });

  it('manual tenant creation writes audit', async () => {
    const admin = await createStaffFixture({
      isPlatformAdmin: true,
      tenantId: null,
      email: 'platform-create@test-zanflo.test',
    });
    const platformCookie = await loginPlatform(admin.email, admin.password);

    const response = await fetchWorker('https://example.test/api/platform/tenants', {
      method: 'POST',
      host: 'platform.zanflo.com',
      cookie: platformCookie,
      body: {
        name: 'Manual Onboarded Council',
        slug: 'test-manual-onboarded-council',
        subdomain: 'test-manual-onboarded-council',
        contact_name: 'Manual Contact',
        contact_email: 'manual-contact@test-zanflo.test',
      },
    });

    expect(response.status).toBe(201);
    const tenant = await readJson(response);

    const pool = createTestPool();
    const client = await pool.connect();
    try {
      const audit = await client.query(`
        SELECT action
        FROM audit_logs
        WHERE actor_id = $1
          AND record_id = $2
          AND action = 'tenant.created'
      `, [admin.id, tenant.id]);
      expect(audit.rows).toHaveLength(1);
    } finally {
      client.release();
      await pool.end();
    }
  }, 10000);

  it('initial tenant admin issuance writes audit', async () => {
    const platformAdmin = await createStaffFixture({
      isPlatformAdmin: true,
      tenantId: null,
      email: 'platform-issue-admin@test-zanflo.test',
    });
    const platformCookie = await loginPlatform(platformAdmin.email, platformAdmin.password);
    const tenant = await createTenantFixture({ slug: 'test-platform-issue-target', status: 'pending_setup' });

    const response = await fetchWorker(`https://example.test/api/platform/tenants/${tenant.id}/admin`, {
      method: 'POST',
      host: 'platform.zanflo.com',
      cookie: platformCookie,
      body: {
        email: 'issued-tenant-admin@test-zanflo.test',
        full_name: 'Issued Tenant Admin',
        password: 'IssuedAdminPass123!',
      },
    });

    expect(response.status).toBe(201);

    const pool = createTestPool();
    const client = await pool.connect();
    try {
      const audit = await client.query(`
        SELECT action
        FROM audit_logs
        WHERE tenant_id = $1
          AND actor_id = $2
          AND action = 'tenant_admin.created'
      `, [tenant.id, platformAdmin.id]);
      expect(audit.rows).toHaveLength(1);
    } finally {
      client.release();
      await pool.end();
    }
  }, 10000);

  it('created tenant is only usable when status allows', async () => {
    const tenant = await createTenantFixture({ slug: 'test-platform-status-check', status: 'pending_setup' });
    const applicant = await createApplicantFixture({ tenantId: tenant.id });

    const blockedResponse = await fetchWorker('https://example.test/api/applicant/login', {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      body: {
        email: applicant.email,
        password: applicant.password,
      },
    });
    expect(blockedResponse.status).toBe(403);

    const platformAdmin = await createStaffFixture({
      isPlatformAdmin: true,
      tenantId: null,
      email: 'platform-status-admin@test-zanflo.test',
    });
    const platformCookie = await loginPlatform(platformAdmin.email, platformAdmin.password);

    const activateResponse = await fetchWorker(`https://example.test/api/platform/tenants/${tenant.id}/status`, {
      method: 'PUT',
      host: 'platform.zanflo.com',
      cookie: platformCookie,
      body: { status: 'active' },
    });
    expect(activateResponse.status).toBe(200);

    const allowedResponse = await fetchWorker('https://example.test/api/applicant/login', {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      body: {
        email: applicant.email,
        password: applicant.password,
      },
    });
    expect(allowedResponse.status).toBe(200);
  });

  it('self-service signup can exchange a bootstrap link into a tenant staff session', async () => {
    const signupResponse = await fetchWorker('https://example.test/api/platform/signup', {
      method: 'POST',
      host: 'zanflo.com',
      body: {
        organisation_name: 'Test Bootstrap Exchange Council',
        subdomain_slug: 'test-bootstrap-exchange-council',
        admin_full_name: 'Bootstrap Owner',
        admin_email: 'bootstrap-owner@test-zanflo.test',
        password: 'Council12',
        password_confirmation: 'Council12',
        accept_terms: true,
      },
    });

    expect(signupResponse.status).toBe(201);
    const signupJson = await readJson(signupResponse);
    const token = signupJson.bootstrap_redirect.split('token=')[1];

    const exchangeResponse = await fetchWorker('https://example.test/api/staff/bootstrap-exchange', {
      method: 'POST',
      host: 'test-bootstrap-exchange-council.zanflo.com',
      body: { token },
    });

    expect(exchangeResponse.status).toBe(200);
    expect(getCookie(exchangeResponse, 'session')).toBeTruthy();
    const exchangeJson = await readJson(exchangeResponse);
    expect(exchangeJson.session.role).toBe('tenant_admin');
    expect(exchangeJson.session.tenant_slug).toBe('test-bootstrap-exchange-council');
  });
});
