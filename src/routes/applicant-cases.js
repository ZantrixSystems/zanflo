/**
 * Applicant-facing premise licence case routes.
 *
 * One premises = one case. The applicant creates a case, selects licence sections,
 * fills in section fields, and submits. If they later edit a licensed case, the
 * status resets and it returns to the officer queue.
 *
 * Routes:
 *   GET  /api/cases                           — list applicant's cases
 *   POST /api/cases                           — create case for a premises
 *   GET  /api/cases/:id                       — get case detail + sections + events
 *   PUT  /api/cases/:id                       — update case details / section answers
 *   POST /api/cases/:id/submit                — submit (draft → submitted) or re-submit (modification)
 *   POST /api/cases/:id/respond               — applicant responds to information request
 */

import { getDb } from '../db/client.js';
import { requireApplicant } from '../lib/guards.js';
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

async function writeCaseEvent(sql, { tenantId, caseId, eventType, actorType, actorId, payload = {} }) {
  await sql`
    INSERT INTO case_events (tenant_id, case_id, event_type, actor_type, actor_id, payload)
    VALUES (${tenantId}, ${caseId}, ${eventType}, ${actorType}, ${actorId ?? null}, ${JSON.stringify(payload)})
  `;
}

// ---------------------------------------------------------------------------
// Load a case for this applicant (ownership check)
// ---------------------------------------------------------------------------
async function loadApplicantCase(sql, tenantId, applicantAccountId, caseId) {
  const rows = await sql`
    SELECT
      c.*,
      t.slug AS tenant_slug
    FROM premise_licence_cases c
    INNER JOIN tenants t ON t.id = c.tenant_id
    WHERE c.tenant_id            = ${tenantId}
      AND c.applicant_account_id = ${applicantAccountId}
      AND c.id                   = ${caseId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function loadCaseSections(sql, tenantId, caseId) {
  return sql`
    SELECT
      css.id,
      css.section_definition_id,
      css.section_slug,
      css.answers,
      css.selected_at,
      css.updated_at,
      lsd.name        AS section_name,
      lsd.description AS section_description,
      lsd.fields      AS section_fields,
      lsd.is_enabled  AS section_is_enabled
    FROM case_selected_sections css
    INNER JOIN licence_section_definitions lsd ON lsd.id = css.section_definition_id
    WHERE css.tenant_id = ${tenantId}
      AND css.case_id   = ${caseId}
    ORDER BY lsd.display_order ASC, lsd.name ASC
  `;
}

async function loadCaseEvents(sql, tenantId, caseId) {
  // Applicants see: their own messages, information_requested, status_changed,
  // decision_made. They do NOT see officer_note (internal).
  return sql`
    SELECT
      ce.id,
      ce.event_type,
      ce.actor_type,
      ce.payload,
      ce.created_at,
      COALESCE(u.full_name, aa.full_name) AS actor_name
    FROM case_events ce
    LEFT JOIN users              u  ON u.id  = ce.actor_id AND ce.actor_type IN ('officer','manager','tenant_admin')
    LEFT JOIN applicant_accounts aa ON aa.id = ce.actor_id AND ce.actor_type = 'applicant'
    WHERE ce.tenant_id = ${tenantId}
      AND ce.case_id   = ${caseId}
      AND ce.event_type <> 'officer_note'
    ORDER BY ce.created_at ASC
  `;
}

// ---------------------------------------------------------------------------
// GET /api/cases
// ---------------------------------------------------------------------------
async function listCases(request, env) {
  const session = await requireApplicant(request, env);
  if (!session) return error('Not authenticated', 401);

  const sql = getDb(env);
  const rows = await sql`
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
      c.premises_id,
      t.slug AS tenant_slug,
      (
        SELECT json_agg(json_build_object('slug', css.section_slug, 'name', lsd.name))
        FROM case_selected_sections css
        INNER JOIN licence_section_definitions lsd ON lsd.id = css.section_definition_id
        WHERE css.case_id = c.id
      ) AS sections
    FROM premise_licence_cases c
    INNER JOIN tenants t ON t.id = c.tenant_id
    WHERE c.tenant_id            = ${session.tenant_id}
      AND c.applicant_account_id = ${session.applicant_account_id}
    ORDER BY c.updated_at DESC
  `;

  return json({ cases: rows });
}

// ---------------------------------------------------------------------------
// POST /api/cases   { premises_id, section_ids?: [] }
// ---------------------------------------------------------------------------
async function createCase(request, env) {
  const session = await requireApplicant(request, env);
  if (!session) return error('Not authenticated', 401);

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON'); }

  const premisesId = body.premises_id?.trim();
  if (!premisesId) return error('premises_id is required');

  const sql = getDb(env);

  // Verify premises belongs to this applicant
  const [premises] = await sql`
    SELECT id, premises_name, address_line_1, address_line_2, town_or_city, postcode, premises_description
    FROM premises
    WHERE id = ${premisesId}
      AND tenant_id = ${session.tenant_id}
      AND applicant_account_id = ${session.applicant_account_id}
    LIMIT 1
  `;
  if (!premises) return error('Premises not found', 404);

  // One case per premises — check for existing
  const existing = await sql`
    SELECT id FROM premise_licence_cases
    WHERE premises_id = ${premisesId} AND tenant_id = ${session.tenant_id}
    LIMIT 1
  `;
  if (existing.length > 0) {
    return error('A case already exists for this premises. Open the existing case to update it.', 409);
  }

  const [plc] = await sql`
    INSERT INTO premise_licence_cases (
      tenant_id, applicant_account_id, premises_id,
      premises_name, address_line_1, address_line_2, town_or_city, postcode, premises_description,
      status
    )
    VALUES (
      ${session.tenant_id}, ${session.applicant_account_id}, ${premisesId},
      ${premises.premises_name}, ${premises.address_line_1}, ${premises.address_line_2 ?? null},
      ${premises.town_or_city ?? null}, ${premises.postcode}, ${premises.premises_description ?? null},
      'draft'
    )
    RETURNING *
  `;

  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId:    plc.id,
    eventType: 'case_created',
    actorType: 'applicant',
    actorId:   session.applicant_account_id,
    payload:   { premises_name: premises.premises_name },
  });

  await writeAuditLog(sql, {
    tenantId:   session.tenant_id,
    actorType:  'applicant',
    actorId:    session.applicant_account_id,
    action:     'premise_case.created',
    recordType: 'premise_licence_case',
    recordId:   plc.id,
    meta:       { premises_id: premisesId, premises_name: premises.premises_name },
  });

  return json({ case: plc }, 201);
}

// ---------------------------------------------------------------------------
// GET /api/cases/:id
// ---------------------------------------------------------------------------
async function getCase(request, env, caseId) {
  const session = await requireApplicant(request, env);
  if (!session) return error('Not authenticated', 401);

  const sql = getDb(env);
  const [plc, sections, events, availableSections] = await Promise.all([
    loadApplicantCase(sql, session.tenant_id, session.applicant_account_id, caseId),
    loadCaseSections(sql, session.tenant_id, caseId),
    loadCaseEvents(sql, session.tenant_id, caseId),
    // Return enabled sections so applicant can choose
    sql`
      SELECT id, slug, name, description, fields, display_order
      FROM licence_section_definitions
      WHERE tenant_id = ${session.tenant_id} AND is_enabled = TRUE
      ORDER BY display_order ASC, name ASC
    `,
  ]);

  if (!plc) return error('Case not found', 404);

  return json({
    case: {
      ...plc,
      ref: formatRef(plc.tenant_slug, plc.ref_number),
    },
    sections,
    events,
    available_sections: availableSections,
  });
}

// ---------------------------------------------------------------------------
// PUT /api/cases/:id
// Update premises details or section selections + answers.
// Allowed in: draft, awaiting_information, and (with modification logic) licensed/refused.
// ---------------------------------------------------------------------------
async function updateCase(request, env, caseId) {
  const session = await requireApplicant(request, env);
  if (!session) return error('Not authenticated', 401);

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON'); }

  const sql = getDb(env);
  const plc = await loadApplicantCase(sql, session.tenant_id, session.applicant_account_id, caseId);
  if (!plc) return error('Case not found', 404);

  const EDITABLE = ['draft', 'awaiting_information', 'licensed', 'refused'];
  if (!EDITABLE.includes(plc.status)) {
    return error('Case cannot be edited in its current status. Wait for it to return to draft or be decided.', 409);
  }

  const isModification = ['licensed', 'refused'].includes(plc.status);

  // Update premises snapshot fields if provided
  const premisesUpdates = {};
  if (body.premises_name)        premisesUpdates.premises_name        = body.premises_name.trim();
  if (body.address_line_1)       premisesUpdates.address_line_1       = body.address_line_1.trim();
  if (body.address_line_2 !== undefined) premisesUpdates.address_line_2 = body.address_line_2?.trim() ?? null;
  if (body.town_or_city !== undefined)   premisesUpdates.town_or_city   = body.town_or_city?.trim() ?? null;
  if (body.postcode)             premisesUpdates.postcode             = body.postcode.trim();
  if (body.premises_description !== undefined) premisesUpdates.premises_description = body.premises_description?.trim() ?? null;

  if (Object.keys(premisesUpdates).length > 0) {
    await sql`
      UPDATE premise_licence_cases
      SET
        premises_name        = COALESCE(${premisesUpdates.premises_name ?? null},        premises_name),
        address_line_1       = COALESCE(${premisesUpdates.address_line_1 ?? null},       address_line_1),
        address_line_2       = CASE WHEN ${premisesUpdates.address_line_2 !== undefined} THEN ${premisesUpdates.address_line_2 ?? null} ELSE address_line_2 END,
        town_or_city         = CASE WHEN ${premisesUpdates.town_or_city !== undefined} THEN ${premisesUpdates.town_or_city ?? null} ELSE town_or_city END,
        postcode             = COALESCE(${premisesUpdates.postcode ?? null},             postcode),
        premises_description = CASE WHEN ${premisesUpdates.premises_description !== undefined} THEN ${premisesUpdates.premises_description ?? null} ELSE premises_description END,
        updated_at           = NOW()
      WHERE id = ${caseId} AND tenant_id = ${session.tenant_id}
    `;
  }

  // Handle section selections: body.sections = [{ section_definition_id, answers: {} }]
  if (Array.isArray(body.sections)) {
    for (const s of body.sections) {
      if (!s.section_definition_id) continue;

      // Verify the section definition exists and is enabled for this tenant
      const [def] = await sql`
        SELECT id, slug, name FROM licence_section_definitions
        WHERE id = ${s.section_definition_id}
          AND tenant_id = ${session.tenant_id}
          AND is_enabled = TRUE
        LIMIT 1
      `;
      if (!def) continue; // silently skip unknown/disabled sections

      const answers = (s.answers && typeof s.answers === 'object') ? s.answers : {};

      await sql`
        INSERT INTO case_selected_sections (tenant_id, case_id, section_definition_id, section_slug, answers)
        VALUES (${session.tenant_id}, ${caseId}, ${def.id}, ${def.slug}, ${JSON.stringify(answers)})
        ON CONFLICT (case_id, section_definition_id)
        DO UPDATE SET answers = ${JSON.stringify(answers)}, updated_at = NOW()
      `;
    }
  }

  // Handle section removals: body.remove_sections = [section_definition_id, ...]
  if (Array.isArray(body.remove_sections) && body.remove_sections.length > 0) {
    for (const defId of body.remove_sections) {
      await sql`
        DELETE FROM case_selected_sections
        WHERE case_id = ${caseId}
          AND section_definition_id = ${defId}
          AND tenant_id = ${session.tenant_id}
      `;
    }
  }

  // If this is a modification of a licensed/refused case, flag it
  if (isModification) {
    await sql`
      UPDATE premise_licence_cases
      SET last_modified_at = NOW(), updated_at = NOW()
      WHERE id = ${caseId} AND tenant_id = ${session.tenant_id}
    `;

    await writeCaseEvent(sql, {
      tenantId:  session.tenant_id,
      caseId,
      eventType: 'case_modified',
      actorType: 'applicant',
      actorId:   session.applicant_account_id,
      payload:   { previous_status: plc.status },
    });
  }

  return json({ updated: true });
}

// ---------------------------------------------------------------------------
// POST /api/cases/:id/submit
// draft → submitted (first submission)
// modified licensed/refused → submitted (re-submission after modification)
// ---------------------------------------------------------------------------
async function submitCase(request, env, caseId) {
  const session = await requireApplicant(request, env);
  if (!session) return error('Not authenticated', 401);

  const sql = getDb(env);
  const plc = await loadApplicantCase(sql, session.tenant_id, session.applicant_account_id, caseId);
  if (!plc) return error('Case not found', 404);

  const SUBMITTABLE = ['draft', 'licensed', 'refused'];
  if (!SUBMITTABLE.includes(plc.status)) {
    return error('This case cannot be submitted in its current status', 409);
  }

  // Must have at least one section selected
  const [sectionCount] = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM case_selected_sections
    WHERE case_id = ${caseId} AND tenant_id = ${session.tenant_id}
  `;
  if (Number(sectionCount.cnt) === 0) {
    return error('At least one licence section must be selected before submitting');
  }

  const previousStatus = plc.status;
  const isResubmit = ['licensed', 'refused'].includes(previousStatus);

  await sql`
    UPDATE premise_licence_cases
    SET
      status         = 'submitted',
      submitted_at   = COALESCE(submitted_at, NOW()),
      last_modified_at = CASE WHEN ${isResubmit} THEN NOW() ELSE last_modified_at END,
      updated_at     = NOW()
    WHERE id = ${caseId} AND tenant_id = ${session.tenant_id}
  `;

  const eventType = isResubmit ? 'case_modified' : 'case_submitted';
  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId,
    eventType,
    actorType: 'applicant',
    actorId:   session.applicant_account_id,
    payload:   isResubmit ? { previous_status: previousStatus } : {},
  });

  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId,
    eventType: 'status_changed',
    actorType: 'applicant',
    actorId:   session.applicant_account_id,
    payload:   { from: previousStatus, to: 'submitted' },
  });

  await writeAuditLog(sql, {
    tenantId:   session.tenant_id,
    actorType:  'applicant',
    actorId:    session.applicant_account_id,
    action:     isResubmit ? 'premise_case.resubmitted' : 'premise_case.submitted',
    recordType: 'premise_licence_case',
    recordId:   caseId,
    meta:       { previous_status: previousStatus },
  });

  return json({ status: 'submitted' });
}

// ---------------------------------------------------------------------------
// POST /api/cases/:id/respond   { notes }
// Applicant responds to information request: awaiting_information → waiting_on_officer
// ---------------------------------------------------------------------------
async function respondToRequest(request, env, caseId) {
  const session = await requireApplicant(request, env);
  if (!session) return error('Not authenticated', 401);

  let body;
  try { body = await request.json(); } catch { return error('Invalid JSON'); }

  const notes = body.notes?.trim();
  if (!notes) return error('notes are required');
  if (notes.length > 2000) return error('Response must be 2000 characters or fewer');

  const sql = getDb(env);
  const plc = await loadApplicantCase(sql, session.tenant_id, session.applicant_account_id, caseId);
  if (!plc) return error('Case not found', 404);

  if (plc.status !== 'awaiting_information') {
    return error('You can only respond when information has been requested', 409);
  }

  await sql`
    UPDATE premise_licence_cases
    SET status = 'waiting_on_officer', updated_at = NOW()
    WHERE id = ${caseId} AND tenant_id = ${session.tenant_id}
  `;

  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId,
    eventType: 'information_provided',
    actorType: 'applicant',
    actorId:   session.applicant_account_id,
    payload:   { notes },
  });

  await writeCaseEvent(sql, {
    tenantId:  session.tenant_id,
    caseId,
    eventType: 'status_changed',
    actorType: 'applicant',
    actorId:   session.applicant_account_id,
    payload:   { from: 'awaiting_information', to: 'waiting_on_officer' },
  });

  await writeAuditLog(sql, {
    tenantId:   session.tenant_id,
    actorType:  'applicant',
    actorId:    session.applicant_account_id,
    action:     'premise_case.information_provided',
    recordType: 'premise_licence_case',
    recordId:   caseId,
    meta:       { notes },
  });

  return json({ status: 'waiting_on_officer' });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export async function handleApplicantCaseRoutes(request, env) {
  const url    = new URL(request.url);
  const { method } = request;

  if (url.pathname === '/api/cases' && method === 'GET')  return listCases(request, env);
  if (url.pathname === '/api/cases' && method === 'POST') return createCase(request, env);

  const detailMatch = url.pathname.match(/^\/api\/cases\/([^/]+)$/);
  if (detailMatch) {
    if (method === 'GET') return getCase(request, env, detailMatch[1]);
    if (method === 'PUT') return updateCase(request, env, detailMatch[1]);
  }

  const actionMatch = url.pathname.match(/^\/api\/cases\/([^/]+)\/([^/]+)$/);
  if (actionMatch && method === 'POST') {
    const [, id, action] = actionMatch;
    if (action === 'submit')  return submitCase(request, env, id);
    if (action === 'respond') return respondToRequest(request, env, id);
  }

  return null;
}
