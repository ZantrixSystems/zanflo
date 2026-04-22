/**
 * Officer/manager case management for premise licence cases.
 *
 * Routes:
 *   GET  /api/admin/premise-cases              — filtered case list
 *   GET  /api/admin/premise-cases/stats        — queue stat counts
 *   GET  /api/admin/premise-cases/:id          — case detail + sections + events
 *   POST /api/admin/premise-cases/:id/assign   — assign to officer
 *   POST /api/admin/premise-cases/:id/request-information — request more info
 *   POST /api/admin/premise-cases/:id/verify   — mark as verified (→ under_consultation)
 *   POST /api/admin/premise-cases/:id/decision — licensed or refused
 *   POST /api/admin/premise-cases/:id/note     — add internal officer note
 *   DELETE /api/admin/premise-cases/:id        — delete case (manager only for decided)
 */

import { getDb } from '../db/client.js';
import { requireTenantStaffWithPermissions, hasPermission } from '../lib/guards.js';
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

function formatRef(tenantSlug, refNumber) {
  const prefix = (tenantSlug || 'CASE').slice(0, 4).toUpperCase();
  return `${prefix}-${String(refNumber).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Load a single case for this tenant
// ---------------------------------------------------------------------------
async function loadCase(sql, tenantId, caseId) {
  const rows = await sql`
    SELECT
      c.*,
      p.address_line_1      AS p_address_line_1,
      p.address_line_2      AS p_address_line_2,
      p.town_or_city        AS p_town_or_city,
      p.verification_state  AS p_verification_state,
      aa.full_name          AS applicant_name,
      aa.email              AS applicant_email,
      aa.phone              AS applicant_phone,
      u.full_name           AS assigned_user_name,
      u.email               AS assigned_user_email,
      t.slug                AS tenant_slug
    FROM premise_licence_cases c
    INNER JOIN premises p          ON p.id  = c.premises_id AND p.tenant_id = c.tenant_id
    INNER JOIN applicant_accounts aa ON aa.id = c.applicant_account_id
    LEFT JOIN  users u             ON u.id  = c.assigned_user_id
    INNER JOIN tenants t           ON t.id  = c.tenant_id
    WHERE c.tenant_id = ${tenantId}
      AND c.id        = ${caseId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function loadCaseSections(sql, tenantId, caseId) {
  return sql`
    SELECT
      css.id,
      css.section_slug,
      css.answers,
      css.selected_at,
      css.updated_at,
      lsd.name        AS section_name,
      lsd.description AS section_description,
      lsd.fields      AS section_fields
    FROM case_selected_sections css
    INNER JOIN licence_section_definitions lsd ON lsd.id = css.section_definition_id
    WHERE css.tenant_id = ${tenantId}
      AND css.case_id   = ${caseId}
    ORDER BY lsd.display_order ASC, lsd.name ASC
  `;
}

async function loadCaseEvents(sql, tenantId, caseId) {
  return sql`
    SELECT
      ce.id,
      ce.event_type,
      ce.actor_type,
      ce.actor_id,
      ce.payload,
      ce.created_at,
      COALESCE(u.full_name, aa.full_name) AS actor_name,
      COALESCE(u.email,     aa.email)     AS actor_email
    FROM case_events ce
    LEFT JOIN users             u  ON u.id  = ce.actor_id AND ce.actor_type IN ('officer','manager','tenant_admin')
    LEFT JOIN applicant_accounts aa ON aa.id = ce.actor_id AND ce.actor_type = 'applicant'
    WHERE ce.tenant_id = ${tenantId}
      AND ce.case_id   = ${caseId}
    ORDER BY ce.created_at ASC
  `;
}

// ---------------------------------------------------------------------------
// Write a case_event
// ---------------------------------------------------------------------------
async function writeCaseEvent(sql, { tenantId, caseId, eventType, actorType, actorId, payload = {} }) {
  await sql`
    INSERT INTO case_events (tenant_id, case_id, event_type, actor_type, actor_id, payload)
    VALUES (${tenantId}, ${caseId}, ${eventType}, ${actorType}, ${actorId ?? null}, ${JSON.stringify(payload)})
  `;
}

// ---------------------------------------------------------------------------
// GET /api/admin/premise-cases
// ---------------------------------------------------------------------------
async function listCases(request, env) {
  const session = await requireTenantStaffWithPermissions(request, env, 'officer', 'manager', 'tenant_admin');
  if (!session) return error('Not authorised', 403);
  if (!hasPermission(session, 'cases.view')) return error('Not authorised', 403);

  const url  = new URL(request.url);
  const sql  = getDb(env);
  const tid  = session.tenant_id;
  const uid  = session.user_id;

  // Filters
  const status     = url.searchParams.get('status') || null;
  const assigned   = url.searchParams.get('assigned') || null;
  const search     = url.searchParams.get('search')?.trim() || null;
  const postcode   = url.searchParams.get('postcode')?.trim() || null;
  const updatedAfter  = url.searchParams.get('updated_after') || null;
  const updatedBefore = url.searchParams.get('updated_before') || null;
  const sort       = url.searchParams.get('sort') || 'updated';

  const VALID_STATUSES = new Set([
    'draft','submitted','under_review','awaiting_information',
    'waiting_on_officer','verified','under_consultation','licensed','refused',
  ]);

  const SORT_COLS = {
    updated: 'c.updated_at DESC',
    created: 'c.created_at DESC',
    status:  'c.status ASC, c.updated_at DESC',
    ref:     'c.ref_number ASC',
  };
  const orderBy = SORT_COLS[sort] ?? SORT_COLS.updated;

  // Build dynamic WHERE clauses using positional params (UNION-free here)
  const filters = [`c.tenant_id = $1`, `c.status <> 'draft'`];
  const params  = [tid];

  if (status && VALID_STATUSES.has(status)) {
    params.push(status);
    filters.push(`c.status = $${params.length}`);
  }

  if (assigned === 'mine') {
    params.push(uid);
    filters.push(`c.assigned_user_id = $${params.length}`);
  } else if (assigned === 'unassigned') {
    filters.push(`c.assigned_user_id IS NULL`);
  }

  if (search) {
    // Trim and search across premises name, postcode, address
    params.push(`%${search}%`);
    const n = params.length;
    filters.push(`(c.premises_name ILIKE $${n} OR c.postcode ILIKE $${n} OR c.address_line_1 ILIKE $${n})`);
  }

  if (postcode) {
    params.push(`%${postcode}%`);
    filters.push(`c.postcode ILIKE $${params.length}`);
  }

  if (updatedAfter) {
    params.push(updatedAfter);
    filters.push(`c.updated_at >= $${params.length}::timestamptz`);
  }

  if (updatedBefore) {
    params.push(updatedBefore);
    filters.push(`c.updated_at <= $${params.length}::timestamptz`);
  }

  const where = filters.join(' AND ');

  const rows = await sql(`
    SELECT
      c.id,
      c.ref_number,
      c.status,
      c.premises_name,
      c.postcode,
      c.address_line_1,
      c.submitted_at,
      c.last_modified_at,
      c.created_at,
      c.updated_at,
      c.assigned_user_id,
      u.full_name   AS assigned_user_name,
      aa.full_name  AS applicant_name,
      aa.email      AS applicant_email,
      t.slug        AS tenant_slug,
      (
        SELECT json_agg(json_build_object('slug', css.section_slug, 'name', lsd.name))
        FROM case_selected_sections css
        INNER JOIN licence_section_definitions lsd ON lsd.id = css.section_definition_id
        WHERE css.case_id = c.id
      ) AS sections
    FROM premise_licence_cases c
    LEFT JOIN users             u  ON u.id  = c.assigned_user_id
    LEFT JOIN applicant_accounts aa ON aa.id = c.applicant_account_id
    INNER JOIN tenants          t  ON t.id  = c.tenant_id
    WHERE ${where}
    ORDER BY ${orderBy}
  `, params);

  return json({ cases: rows });
}

// ---------------------------------------------------------------------------
// GET /api/admin/premise-cases/stats
// ---------------------------------------------------------------------------
async function getCaseStats(request, env) {
  const session = await requireTenantStaffWithPermissions(request, env, 'officer', 'manager', 'tenant_admin');
  if (!session) return error('Not authorised', 403);
  if (!hasPermission(session, 'cases.view')) return error('Not authorised', 403);

  const sql = getDb(env);
  const tid = session.tenant_id;
  const uid = session.user_id;

  const [row] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status <> 'draft')                                AS total,
      COUNT(*) FILTER (WHERE status = 'submitted')                             AS submitted,
      COUNT(*) FILTER (WHERE status IN ('submitted','under_review','awaiting_information','waiting_on_officer','verified','under_consultation')) AS active,
      COUNT(*) FILTER (WHERE assigned_user_id = ${uid} AND status <> 'draft') AS assigned_to_me,
      COUNT(*) FILTER (WHERE assigned_user_id IS NULL AND status <> 'draft')  AS unassigned,
      COUNT(*) FILTER (WHERE status = 'awaiting_information')                  AS awaiting_information,
      COUNT(*) FILTER (WHERE status = 'waiting_on_officer')                    AS waiting_on_officer,
      COUNT(*) FILTER (WHERE status = 'licensed')                              AS licensed,
      COUNT(*) FILTER (WHERE status = 'refused')                               AS refused
    FROM premise_licence_cases
    WHERE tenant_id = ${tid}
  `;

  return json({
    stats: {
      total:                Number(row.total ?? 0),
      submitted:            Number(row.submitted ?? 0),
      active:               Number(row.active ?? 0),
      assigned_to_me:       Number(row.assigned_to_me ?? 0),
      unassigned:           Number(row.unassigned ?? 0),
      awaiting_information: Number(row.awaiting_information ?? 0),
      waiting_on_officer:   Number(row.waiting_on_officer ?? 0),
      licensed:             Number(row.licensed ?? 0),
      refused:              Number(row.refused ?? 0),
    },
  });
}

// ---------------------------------------------------------------------------
// GET /api/admin/premise-cases/:id
// ---------------------------------------------------------------------------
async function getCase(request, env, caseId) {
  const session = await requireTenantStaffWithPermissions(request, env, 'officer', 'manager', 'tenant_admin');
  if (!session) return error('Not authorised', 403);
  if (!hasPermission(session, 'cases.view')) return error('Not authorised', 403);

  const sql = getDb(env);
  const [plc, sections, events] = await Promise.all([
    loadCase(sql, session.tenant_id, caseId),
    loadCaseSections(sql, session.tenant_id, caseId),
    loadCaseEvents(sql, session.tenant_id, caseId),
  ]);

  if (!plc) return error('Case not found', 404);

  return json({
    case: {
      ...plc,
      ref: formatRef(plc.tenant_slug, plc.ref_number),
    },
    sections,
    events,
  });
}

// ---------------------------------------------------------------------------
// POST /api/admin/premise-cases/:id/assign
// ---------------------------------------------------------------------------
async function assignCase(request, env, caseId) {
  const session = await requireTenantStaffWithPermissions(request, env, 'officer', 'manager', 'tenant_admin');
  if (!session) return error('Not authorised', 403);
  if (!hasPermission(session, 'cases.assign')) return error('Not authorised', 403);

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON'); }

  const assignedUserId = body.assigned_user_id?.trim();
  if (!assignedUserId) return error('assigned_user_id is required');

  if (session.role === 'officer' && assignedUserId !== session.user_id) {
    return error('Officers can only assign cases to themselves', 403);
  }

  const sql = getDb(env);
  const plc = await loadCase(sql, session.tenant_id, caseId);
  if (!plc) return error('Case not found', 404);

  const ASSIGNABLE = ['submitted', 'under_review', 'awaiting_information', 'waiting_on_officer', 'verified', 'under_consultation'];
  if (!ASSIGNABLE.includes(plc.status)) return error('Case cannot be assigned in its current status', 409);

  if (session.role === 'officer' && plc.assigned_user_id && plc.assigned_user_id !== session.user_id) {
    return error('Only the assigned officer or a manager can reassign this case', 403);
  }

  const [assignee] = await sql`
    SELECT u.id, u.full_name, u.email
    FROM memberships m
    INNER JOIN users u ON u.id = m.user_id
    WHERE m.tenant_id = ${session.tenant_id} AND m.user_id = ${assignedUserId}
    LIMIT 1
  `;
  if (!assignee) return error('Assignee not found in this tenant', 404);

  await sql`
    UPDATE premise_licence_cases
    SET
      assigned_user_id = ${assignee.id},
      assigned_at      = NOW(),
      status           = CASE WHEN status = 'submitted' THEN 'under_review' ELSE status END,
      updated_at       = NOW()
    WHERE id = ${caseId} AND tenant_id = ${session.tenant_id}
  `;

  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId,
    eventType: 'officer_assigned',
    actorType: session.role,
    actorId:   session.user_id,
    payload:   { user_id: assignee.id, user_name: assignee.full_name },
  });

  if (plc.status === 'submitted') {
    await writeCaseEvent(sql, {
      tenantId:  session.tenant_id,
      caseId,
      eventType: 'status_changed',
      actorType: session.role,
      actorId:   session.user_id,
      payload:   { from: 'submitted', to: 'under_review' },
    });
  }

  await writeAuditLog(sql, {
    tenantId:   session.tenant_id,
    actorType:  session.role,
    actorId:    session.user_id,
    action:     'premise_case.assigned',
    recordType: 'premise_licence_case',
    recordId:   caseId,
    meta:       { assigned_user_id: assignee.id, assigned_user_email: assignee.email },
  });

  return json({ assigned: true });
}

// ---------------------------------------------------------------------------
// POST /api/admin/premise-cases/:id/request-information
// ---------------------------------------------------------------------------
async function requestInformation(request, env, caseId) {
  const session = await requireTenantStaffWithPermissions(request, env, 'officer', 'manager', 'tenant_admin');
  if (!session) return error('Not authorised', 403);
  if (!hasPermission(session, 'cases.decide')) return error('Not authorised', 403);

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON'); }

  const notes = body.notes?.trim();
  if (!notes) return error('notes are required when requesting information');

  const sql = getDb(env);
  const plc = await loadCase(sql, session.tenant_id, caseId);
  if (!plc) return error('Case not found', 404);

  const ALLOWED = ['submitted', 'under_review', 'waiting_on_officer'];
  if (!ALLOWED.includes(plc.status)) {
    return error('Information can only be requested when the case is under review', 409);
  }

  await sql`
    UPDATE premise_licence_cases
    SET
      status           = 'awaiting_information',
      assigned_user_id = COALESCE(assigned_user_id, ${session.user_id}),
      assigned_at      = COALESCE(assigned_at, NOW()),
      updated_at       = NOW()
    WHERE id = ${caseId} AND tenant_id = ${session.tenant_id}
  `;

  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId,
    eventType: 'information_requested',
    actorType: session.role,
    actorId:   session.user_id,
    payload:   { notes },
  });

  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId,
    eventType: 'status_changed',
    actorType: session.role,
    actorId:   session.user_id,
    payload:   { from: plc.status, to: 'awaiting_information' },
  });

  await writeAuditLog(sql, {
    tenantId:   session.tenant_id,
    actorType:  session.role,
    actorId:    session.user_id,
    action:     'premise_case.information_requested',
    recordType: 'premise_licence_case',
    recordId:   caseId,
    meta:       { notes },
  });

  return json({ status: 'awaiting_information' });
}

// ---------------------------------------------------------------------------
// POST /api/admin/premise-cases/:id/verify
// Transitions: under_review | waiting_on_officer → verified → under_consultation
// ---------------------------------------------------------------------------
async function verifyCase(request, env, caseId) {
  const session = await requireTenantStaffWithPermissions(request, env, 'officer', 'manager', 'tenant_admin');
  if (!session) return error('Not authorised', 403);
  if (!hasPermission(session, 'cases.decide')) return error('Not authorised', 403);

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON'); }
  const notes = body.notes?.trim() ?? null;

  const sql = getDb(env);
  const plc = await loadCase(sql, session.tenant_id, caseId);
  if (!plc) return error('Case not found', 404);

  const ALLOWED = ['under_review', 'waiting_on_officer'];
  if (!ALLOWED.includes(plc.status)) {
    return error('Case can only be verified when under review', 409);
  }

  await sql`
    UPDATE premise_licence_cases
    SET status = 'verified', updated_at = NOW()
    WHERE id = ${caseId} AND tenant_id = ${session.tenant_id}
  `;

  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId,
    eventType: 'status_changed',
    actorType: session.role,
    actorId:   session.user_id,
    payload:   { from: plc.status, to: 'verified', notes },
  });

  await writeAuditLog(sql, {
    tenantId:   session.tenant_id,
    actorType:  session.role,
    actorId:    session.user_id,
    action:     'premise_case.verified',
    recordType: 'premise_licence_case',
    recordId:   caseId,
    meta:       { notes },
  });

  return json({ status: 'verified' });
}

// ---------------------------------------------------------------------------
// POST /api/admin/premise-cases/:id/decision  { decision: 'licensed'|'refused', notes }
// ---------------------------------------------------------------------------
async function recordDecision(request, env, caseId) {
  const session = await requireTenantStaffWithPermissions(request, env, 'officer', 'manager', 'tenant_admin');
  if (!session) return error('Not authorised', 403);
  if (!hasPermission(session, 'cases.decide')) return error('Not authorised', 403);

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON'); }

  const decision = body.decision?.trim();
  const notes    = body.notes?.trim() ?? null;

  if (!['licensed', 'refused'].includes(decision)) {
    return error('decision must be "licensed" or "refused"');
  }
  if (decision === 'refused' && !notes) {
    return error('A reason is required when refusing a case');
  }

  const sql = getDb(env);
  const plc = await loadCase(sql, session.tenant_id, caseId);
  if (!plc) return error('Case not found', 404);

  // Allow decisions from under_consultation; also allow from verified for MVP flexibility
  const ALLOWED = ['under_consultation', 'verified'];
  if (!ALLOWED.includes(plc.status)) {
    return error('A decision can only be made during consultation', 409);
  }

  await sql`
    UPDATE premise_licence_cases
    SET status = ${decision}, updated_at = NOW()
    WHERE id = ${caseId} AND tenant_id = ${session.tenant_id}
  `;

  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId,
    eventType: 'decision_made',
    actorType: session.role,
    actorId:   session.user_id,
    payload:   { decision, notes },
  });

  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId,
    eventType: 'status_changed',
    actorType: session.role,
    actorId:   session.user_id,
    payload:   { from: plc.status, to: decision },
  });

  await writeAuditLog(sql, {
    tenantId:   session.tenant_id,
    actorType:  session.role,
    actorId:    session.user_id,
    action:     `premise_case.${decision}`,
    recordType: 'premise_licence_case',
    recordId:   caseId,
    meta:       { notes },
  });

  return json({ status: decision });
}

// ---------------------------------------------------------------------------
// POST /api/admin/premise-cases/:id/note  { body }
// Internal officer note — not visible to applicant
// ---------------------------------------------------------------------------
async function addNote(request, env, caseId) {
  const session = await requireTenantStaffWithPermissions(request, env, 'officer', 'manager', 'tenant_admin');
  if (!session) return error('Not authorised', 403);

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON'); }

  const text = body.body?.trim();
  if (!text) return error('body is required');
  if (text.length > 2000) return error('Note must be 2000 characters or fewer');

  const sql = getDb(env);
  const plc = await loadCase(sql, session.tenant_id, caseId);
  if (!plc) return error('Case not found', 404);

  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId,
    eventType: 'officer_note',
    actorType: session.role,
    actorId:   session.user_id,
    payload:   { body: text },
  });

  await writeAuditLog(sql, {
    tenantId:   session.tenant_id,
    actorType:  session.role,
    actorId:    session.user_id,
    action:     'premise_case.note_added',
    recordType: 'premise_licence_case',
    recordId:   caseId,
  });

  return json({ noted: true });
}

// ---------------------------------------------------------------------------
// POST /api/admin/premise-cases/:id/move-status  { to_status, comment }
// Generic status transition for moves without a dedicated endpoint.
// Allowed transitions: verified → under_consultation
// ---------------------------------------------------------------------------
async function moveStatus(request, env, caseId) {
  const session = await requireTenantStaffWithPermissions(request, env, 'officer', 'manager', 'tenant_admin');
  if (!session) return error('Not authorised', 403);

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON'); }

  const toStatus = body.to_status?.trim();
  const comment  = body.comment?.trim() ?? null;

  if (!toStatus) return error('to_status is required');
  if (!comment)  return error('A comment is required when changing status');

  const sql = getDb(env);
  const plc = await loadCase(sql, session.tenant_id, caseId);
  if (!plc) return error('Case not found', 404);

  // Fixed allowed transitions for this generic endpoint
  const ALLOWED_TRANSITIONS = {
    verified:             ['under_consultation'],
    awaiting_information: ['under_review'],
    waiting_on_officer:   ['under_review'],
    submitted:            ['under_review'],
  };

  const validNext = ALLOWED_TRANSITIONS[plc.status] ?? [];
  if (!validNext.includes(toStatus)) {
    return error(`Cannot move from ${plc.status} to ${toStatus}`, 409);
  }

  await sql`
    UPDATE premise_licence_cases
    SET status = ${toStatus}, updated_at = NOW()
    WHERE id = ${caseId} AND tenant_id = ${session.tenant_id}
  `;

  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId,
    eventType: 'status_changed',
    actorType: session.role,
    actorId:   session.user_id,
    payload:   { from: plc.status, to: toStatus, comment },
  });

  await writeAuditLog(sql, {
    tenantId:   session.tenant_id,
    actorType:  session.role,
    actorId:    session.user_id,
    action:     'premise_case.status_changed',
    recordType: 'premise_licence_case',
    recordId:   caseId,
    meta:       { from: plc.status, to: toStatus, comment },
  });

  return json({ status: toStatus });
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/premise-cases/:id
// Officers: can delete non-decided cases only
// Managers: can delete any case
// ---------------------------------------------------------------------------
async function deleteCase(request, env, caseId) {
  const session = await requireTenantStaffWithPermissions(request, env, 'officer', 'manager', 'tenant_admin');
  if (!session) return error('Not authorised', 403);

  const sql = getDb(env);
  const plc = await loadCase(sql, session.tenant_id, caseId);
  if (!plc) return error('Case not found', 404);

  const decided = ['licensed', 'refused'].includes(plc.status);
  if (decided && session.role !== 'manager') {
    return error('Only a manager can delete a licensed or refused case', 403);
  }

  await sql`
    DELETE FROM premise_licence_cases
    WHERE id = ${caseId} AND tenant_id = ${session.tenant_id}
  `;

  await writeAuditLog(sql, {
    tenantId:   session.tenant_id,
    actorType:  session.role,
    actorId:    session.user_id,
    action:     'premise_case.deleted',
    recordType: 'premise_licence_case',
    recordId:   caseId,
    meta:       { premises_name: plc.premises_name, status: plc.status },
  });

  return json({ deleted: true });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export async function handleAdminPremiseCaseRoutes(request, env) {
  const url    = new URL(request.url);
  const { method } = request;

  if (url.pathname === '/api/admin/premise-cases' && method === 'GET') {
    return listCases(request, env);
  }

  if (url.pathname === '/api/admin/premise-cases/stats' && method === 'GET') {
    return getCaseStats(request, env);
  }

  const detailMatch = url.pathname.match(/^\/api\/admin\/premise-cases\/([^/]+)$/);
  if (detailMatch) {
    if (method === 'GET')    return getCase(request, env, detailMatch[1]);
    if (method === 'DELETE') return deleteCase(request, env, detailMatch[1]);
  }

  const actionMatch = url.pathname.match(/^\/api\/admin\/premise-cases\/([^/]+)\/([^/]+)$/);
  if (actionMatch && method === 'POST') {
    const [, id, action] = actionMatch;
    if (action === 'assign')              return assignCase(request, env, id);
    if (action === 'request-information') return requestInformation(request, env, id);
    if (action === 'verify')              return verifyCase(request, env, id);
    if (action === 'decision')            return recordDecision(request, env, id);
    if (action === 'note')                return addNote(request, env, id);
    if (action === 'move-status')         return moveStatus(request, env, id);
  }

  return null;
}
