import { beforeEach, describe, expect, it } from 'vitest';
import { createTestPool, resetTestData } from '../helpers/db.js';
import { createStaffFixture, createTenantFixture } from '../helpers/fixtures.js';
import { fetchWorker, getCookie, readJson } from '../helpers/requests.js';

async function loginStaff(tenantSlug, identifier, password) {
  const response = await fetchWorker('https://example.test/api/staff/login', {
    method: 'POST',
    host: `${tenantSlug}.zanflo.com`,
    body: { identifier, password },
  });
  return getCookie(response, 'session');
}

describe('slice 10 - tenant admin basics', () => {
  beforeEach(async () => {
    await resetTestData();
  });

  it('only tenant_admin can access users settings and audit', async () => {
    const tenant = await createTenantFixture({ slug: 'test-tenant-admin-role' });
    const officer = await createStaffFixture({ tenantId: tenant.id, role: 'officer' });
    const officerCookie = await loginStaff(tenant.slug, officer.email, officer.password);

    const usersResponse = await fetchWorker('https://example.test/api/admin/users', {
      method: 'GET',
      host: `${tenant.slug}.zanflo.com`,
      cookie: officerCookie,
    });
    const settingsResponse = await fetchWorker('https://example.test/api/admin/settings', {
      method: 'GET',
      host: `${tenant.slug}.zanflo.com`,
      cookie: officerCookie,
    });
    const auditResponse = await fetchWorker('https://example.test/api/admin/audit', {
      method: 'GET',
      host: `${tenant.slug}.zanflo.com`,
      cookie: officerCookie,
    });

    expect(usersResponse.status).toBe(403);
    expect(settingsResponse.status).toBe(403);
    expect(auditResponse.status).toBe(403);
  });

  it('tenant user creation and update are tenant scoped and audited', async () => {
    const tenant = await createTenantFixture({ slug: 'test-tenant-user-admin' });
    const admin = await createStaffFixture({ tenantId: tenant.id, role: 'tenant_admin' });
    const adminCookie = await loginStaff(tenant.slug, admin.email, admin.password);

    const createResponse = await fetchWorker('https://example.test/api/admin/users', {
      method: 'POST',
      host: `${tenant.slug}.zanflo.com`,
      cookie: adminCookie,
      body: {
        email: 'new-tenant-user@test-zanflo.test',
        full_name: 'New Tenant User',
        role: 'officer',
        password: 'StrongPassword123!',
      },
    });

    expect(createResponse.status).toBe(201);
    const created = await readJson(createResponse);

    const updateResponse = await fetchWorker(`https://example.test/api/admin/users/${created.user.id}`, {
      method: 'PUT',
      host: `${tenant.slug}.zanflo.com`,
      cookie: adminCookie,
      body: {
        role: 'manager',
        full_name: 'Updated Tenant User',
      },
    });

    expect(updateResponse.status).toBe(200);

    const pool = createTestPool();
    const client = await pool.connect();
    try {
      const membership = await client.query(`
        SELECT role
        FROM memberships
        WHERE tenant_id = $1 AND user_id = $2
      `, [tenant.id, created.user.id]);
      expect(membership.rows[0].role).toBe('manager');

      const audit = await client.query(`
        SELECT action
        FROM audit_logs
        WHERE tenant_id = $1
          AND actor_id = $2
          AND record_id = $3
          AND action IN ('tenant_user.created', 'tenant_user.updated')
        ORDER BY action ASC
      `, [tenant.id, admin.id, created.user.id]);
      expect(audit.rows).toHaveLength(2);
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('audit endpoint returns only current tenant rows', async () => {
    const tenantA = await createTenantFixture({ slug: 'test-audit-a' });
    const tenantB = await createTenantFixture({ slug: 'test-audit-b' });
    const adminA = await createStaffFixture({ tenantId: tenantA.id, role: 'tenant_admin' });
    const adminB = await createStaffFixture({ tenantId: tenantB.id, role: 'tenant_admin' });
    const cookieA = await loginStaff(tenantA.slug, adminA.email, adminA.password);
    const cookieB = await loginStaff(tenantB.slug, adminB.email, adminB.password);

    await fetchWorker('https://example.test/api/admin/settings', {
      method: 'PUT',
      host: `${tenantA.slug}.zanflo.com`,
      cookie: cookieA,
      body: { contact_name: 'Tenant A Contact', contact_email: 'tenant-a-contact@test-zanflo.test' },
    });

    await fetchWorker('https://example.test/api/admin/settings', {
      method: 'PUT',
      host: `${tenantB.slug}.zanflo.com`,
      cookie: cookieB,
      body: { contact_name: 'Tenant B Contact', contact_email: 'tenant-b-contact@test-zanflo.test' },
    });

    const response = await fetchWorker('https://example.test/api/admin/audit', {
      method: 'GET',
      host: `${tenantA.slug}.zanflo.com`,
      cookie: cookieA,
    });

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.audit_logs.length).toBeGreaterThan(0);
    expect(json.audit_logs.every((row) => row.actor !== 'Tenant B Contact')).toBe(true);
  }, 10000);
});
