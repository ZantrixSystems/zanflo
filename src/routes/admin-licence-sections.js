/**
 * Licence section definitions — tenant admin configuration.
 *
 * Tenant admins (and managers) can define which licence sections/modules
 * are available for applicants to select when creating a premises case.
 *
 * Each section has a name, slug, enabled state, display order, and a
 * structured list of fields (simple key/label/type — NOT a full form builder).
 *
 * Routes:
 *   GET    /api/admin/licence-sections          — list all for tenant
 *   POST   /api/admin/licence-sections          — create new section
 *   PUT    /api/admin/licence-sections/:id      — update section
 *   DELETE /api/admin/licence-sections/:id      — delete section (if no cases use it)
 *   POST   /api/admin/licence-sections/:id/toggle — enable/disable
 */

import { getDb } from '../db/client.js';
import { requireTenantStaff } from '../lib/guards.js';
import { writeAuditLog } from '../lib/audit.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

// Allowed field types for section fields
const ALLOWED_FIELD_TYPES = new Set(['text', 'textarea', 'boolean']);

function validateFields(fields) {
  if (!Array.isArray(fields)) return 'fields must be an array';
  for (const f of fields) {
    if (!f.key || typeof f.key !== 'string') return 'each field must have a key (string)';
    if (!f.label || typeof f.label !== 'string') return 'each field must have a label (string)';
    if (!ALLOWED_FIELD_TYPES.has(f.type)) return `field type must be one of: ${[...ALLOWED_FIELD_TYPES].join(', ')}`;
    if (!/^[a-z0-9_]+$/.test(f.key)) return `field key "${f.key}" must be lowercase alphanumeric/underscore only`;
  }
  // Check duplicate keys
  const keys = fields.map((f) => f.key);
  if (new Set(keys).size !== keys.length) return 'field keys must be unique within a section';
  return null;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// ---------------------------------------------------------------------------
// GET /api/admin/licence-sections
// ---------------------------------------------------------------------------
async function listSections(request, env) {
  const session = await requireTenantStaff(request, env, 'officer', 'manager', 'tenant_admin');
  if (!session) return error('Not authorised', 403);

  const sql = getDb(env);
  const rows = await sql`
    SELECT id, slug, name, description, fields, is_enabled, display_order, created_at, updated_at
    FROM licence_section_definitions
    WHERE tenant_id = ${session.tenant_id}
    ORDER BY display_order ASC, name ASC
  `;

  return json({ sections: rows });
}

// ---------------------------------------------------------------------------
// POST /api/admin/licence-sections
// ---------------------------------------------------------------------------
async function createSection(request, env) {
  const session = await requireTenantStaff(request, env, 'tenant_admin', 'manager');
  if (!session) return error('Not authorised', 403);

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON'); }

  const name = body.name?.trim();
  if (!name) return error('name is required');
  if (name.length > 120) return error('name must be 120 characters or fewer');

  const slug = body.slug?.trim() || slugify(name);
  if (!/^[a-z0-9_]+$/.test(slug)) return error('slug must be lowercase alphanumeric/underscore only');

  const description = body.description?.trim() ?? null;
  const fields = body.fields ?? [];
  const fieldsError = validateFields(fields);
  if (fieldsError) return error(fieldsError);

  const displayOrder = typeof body.display_order === 'number' ? body.display_order : 0;

  const sql = getDb(env);

  // Check slug uniqueness
  const existing = await sql`
    SELECT id FROM licence_section_definitions
    WHERE tenant_id = ${session.tenant_id} AND slug = ${slug}
    LIMIT 1
  `;
  if (existing.length > 0) return error(`A section with slug "${slug}" already exists`, 409);

  const rows = await sql`
    INSERT INTO licence_section_definitions
      (tenant_id, slug, name, description, fields, is_enabled, display_order)
    VALUES
      (${session.tenant_id}, ${slug}, ${name}, ${description}, ${JSON.stringify(fields)}, TRUE, ${displayOrder})
    RETURNING id, slug, name, description, fields, is_enabled, display_order, created_at, updated_at
  `;

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: session.role,
    actorId: session.user_id,
    action: 'licence_section.created',
    recordType: 'licence_section_definition',
    recordId: rows[0].id,
    meta: { slug, name },
  });

  return json({ section: rows[0] }, 201);
}

// ---------------------------------------------------------------------------
// PUT /api/admin/licence-sections/:id
// ---------------------------------------------------------------------------
async function updateSection(request, env, sectionId) {
  const session = await requireTenantStaff(request, env, 'tenant_admin', 'manager');
  if (!session) return error('Not authorised', 403);

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON'); }

  const sql = getDb(env);
  const existing = (await sql`
    SELECT id FROM licence_section_definitions
    WHERE id = ${sectionId} AND tenant_id = ${session.tenant_id}
    LIMIT 1
  `)[0];
  if (!existing) return error('Section not found', 404);

  const updates = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return error('name cannot be empty');
    if (name.length > 120) return error('name must be 120 characters or fewer');
    updates.name = name;
  }
  if (body.description !== undefined) {
    updates.description = body.description?.trim() ?? null;
  }
  if (body.fields !== undefined) {
    const fieldsError = validateFields(body.fields);
    if (fieldsError) return error(fieldsError);
    updates.fields = JSON.stringify(body.fields);
  }
  if (typeof body.display_order === 'number') {
    updates.display_order = body.display_order;
  }
  if (typeof body.is_enabled === 'boolean') {
    updates.is_enabled = body.is_enabled;
  }

  if (Object.keys(updates).length === 0) return error('No valid fields to update');

  // Build update query
  const rows = await sql`
    UPDATE licence_section_definitions
    SET
      name          = COALESCE(${updates.name ?? null}::text,          name),
      description   = CASE WHEN ${updates.description !== undefined} THEN ${updates.description ?? null} ELSE description END,
      fields        = COALESCE(${updates.fields ?? null}::jsonb,        fields),
      display_order = COALESCE(${updates.display_order ?? null}::int,   display_order),
      is_enabled    = COALESCE(${updates.is_enabled ?? null}::boolean,  is_enabled),
      updated_at    = NOW()
    WHERE id = ${sectionId} AND tenant_id = ${session.tenant_id}
    RETURNING id, slug, name, description, fields, is_enabled, display_order, created_at, updated_at
  `;

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: session.role,
    actorId: session.user_id,
    action: 'licence_section.updated',
    recordType: 'licence_section_definition',
    recordId: sectionId,
    meta: { updates: Object.keys(updates) },
  });

  return json({ section: rows[0] });
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/licence-sections/:id
// ---------------------------------------------------------------------------
async function deleteSection(request, env, sectionId) {
  const session = await requireTenantStaff(request, env, 'tenant_admin');
  if (!session) return error('Not authorised', 403);

  const sql = getDb(env);

  // Block deletion if any cases reference this section
  const inUse = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM case_selected_sections
    WHERE section_definition_id = ${sectionId}
      AND tenant_id = ${session.tenant_id}
  `;
  if (Number(inUse[0]?.cnt) > 0) {
    return error('Cannot delete a section that is selected on one or more cases. Disable it instead.', 409);
  }

  const result = await sql`
    DELETE FROM licence_section_definitions
    WHERE id = ${sectionId} AND tenant_id = ${session.tenant_id}
    RETURNING id, slug, name
  `;
  if (result.length === 0) return error('Section not found', 404);

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: session.role,
    actorId: session.user_id,
    action: 'licence_section.deleted',
    recordType: 'licence_section_definition',
    recordId: sectionId,
    meta: { slug: result[0].slug, name: result[0].name },
  });

  return json({ deleted: true });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export async function handleAdminLicenceSectionRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (url.pathname === '/api/admin/licence-sections') {
    if (method === 'GET')  return listSections(request, env);
    if (method === 'POST') return createSection(request, env);
  }

  const match = url.pathname.match(/^\/api\/admin\/licence-sections\/([^/]+)$/);
  if (match) {
    if (method === 'PUT')    return updateSection(request, env, match[1]);
    if (method === 'DELETE') return deleteSection(request, env, match[1]);
  }

  return null;
}
