import { getDb } from '../db/client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

/**
 * Extract tenant_id from the request.
 * Placeholder until auth is implemented — expects X-Tenant-Id header.
 */
function getTenantId(request) {
  const tenantId = request.headers.get('X-Tenant-Id');
  if (!tenantId) return null;
  return tenantId;
}

const SUBMIT_REQUIRED_FIELDS = [
  'applicant_name',
  'applicant_email',
  'premises_name',
  'premises_address',
];

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * POST /applications
 * Create a new draft application.
 */
async function createApplication(request, env) {
  const tenantId = getTenantId(request);
  if (!tenantId) return error('Missing X-Tenant-Id header', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const {
    applicant_name,
    applicant_email,
    applicant_phone,
    premises_name,
    premises_address,
    premises_description,
  } = body;

  const sql = getDb(env);

  const rows = await sql`
    INSERT INTO applications (
      tenant_id,
      applicant_name,
      applicant_email,
      applicant_phone,
      premises_name,
      premises_address,
      premises_description,
      status
    ) VALUES (
      ${tenantId},
      ${applicant_name ?? null},
      ${applicant_email ?? null},
      ${applicant_phone ?? null},
      ${premises_name ?? null},
      ${premises_address ?? null},
      ${premises_description ?? null},
      'draft'
    )
    RETURNING *
  `;

  return json(rows[0], 201);
}

/**
 * GET /applications/:id
 * Fetch a single application scoped to the tenant.
 */
async function getApplication(request, env, id) {
  const tenantId = getTenantId(request);
  if (!tenantId) return error('Missing X-Tenant-Id header', 401);

  const sql = getDb(env);

  const rows = await sql`
    SELECT *
    FROM applications
    WHERE id = ${id}
      AND tenant_id = ${tenantId}
  `;

  if (rows.length === 0) return error('Not found', 404);
  return json(rows[0]);
}

/**
 * PUT /applications/:id
 * Update a draft application. Submitted applications are locked.
 */
async function updateApplication(request, env, id) {
  const tenantId = getTenantId(request);
  if (!tenantId) return error('Missing X-Tenant-Id header', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const sql = getDb(env);

  // Fetch existing — enforce tenant scope and check status
  const existing = await sql`
    SELECT id, status
    FROM applications
    WHERE id = ${id}
      AND tenant_id = ${tenantId}
  `;

  if (existing.length === 0) return error('Not found', 404);
  if (existing[0].status !== 'draft') return error('Submitted applications cannot be edited', 409);

  const {
    applicant_name,
    applicant_email,
    applicant_phone,
    premises_name,
    premises_address,
    premises_description,
  } = body;

  const rows = await sql`
    UPDATE applications
    SET
      applicant_name       = COALESCE(${applicant_name ?? null}, applicant_name),
      applicant_email      = COALESCE(${applicant_email ?? null}, applicant_email),
      applicant_phone      = COALESCE(${applicant_phone ?? null}, applicant_phone),
      premises_name        = COALESCE(${premises_name ?? null}, premises_name),
      premises_address     = COALESCE(${premises_address ?? null}, premises_address),
      premises_description = COALESCE(${premises_description ?? null}, premises_description),
      updated_at           = NOW()
    WHERE id = ${id}
      AND tenant_id = ${tenantId}
    RETURNING *
  `;

  return json(rows[0]);
}

/**
 * POST /applications/:id/submit
 * Validate required fields then transition status to submitted.
 */
async function submitApplication(request, env, id) {
  const tenantId = getTenantId(request);
  if (!tenantId) return error('Missing X-Tenant-Id header', 401);

  const sql = getDb(env);

  const existing = await sql`
    SELECT *
    FROM applications
    WHERE id = ${id}
      AND tenant_id = ${tenantId}
  `;

  if (existing.length === 0) return error('Not found', 404);

  const app = existing[0];

  if (app.status !== 'draft') return error('Application has already been submitted', 409);

  // Validate required fields are populated
  const missing = SUBMIT_REQUIRED_FIELDS.filter((field) => !app[field]);
  if (missing.length > 0) {
    return error(`Missing required fields: ${missing.join(', ')}`, 400);
  }

  const rows = await sql`
    UPDATE applications
    SET
      status       = 'submitted',
      submitted_at = NOW(),
      updated_at   = NOW()
    WHERE id = ${id}
      AND tenant_id = ${tenantId}
    RETURNING *
  `;

  return json(rows[0]);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export async function handleApplicationRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  // POST /applications
  if (method === 'POST' && url.pathname === '/applications') {
    return createApplication(request, env);
  }

  // Match /applications/:id
  const idMatch = url.pathname.match(/^\/applications\/([^/]+)$/);
  if (idMatch) {
    const id = idMatch[1];
    if (method === 'GET') return getApplication(request, env, id);
    if (method === 'PUT') return updateApplication(request, env, id);
  }

  // Match /applications/:id/submit
  const submitMatch = url.pathname.match(/^\/applications\/([^/]+)\/submit$/);
  if (submitMatch && method === 'POST') {
    return submitApplication(request, env, submitMatch[1]);
  }

  return error('Not found', 404);
}
