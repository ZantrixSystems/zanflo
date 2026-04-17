import { getDb } from '../db/client.js';
import { writeAuditLog } from '../lib/audit.js';
import { requireApplicant } from '../lib/guards.js';
import {
  buildApplicationPremisesSnapshot,
  formatPremisesAddress,
  normalisePremisesPayload,
  validatePremisesPayload,
} from '../lib/premises.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

function serialisePremises(row) {
  return {
    ...row,
    premises_address: formatPremisesAddress(row),
  };
}

async function getOwnedPremises(sql, tenantId, applicantAccountId, premisesId) {
  const rows = await sql`
    SELECT *
    FROM premises
    WHERE id = ${premisesId}
      AND tenant_id = ${tenantId}
      AND applicant_account_id = ${applicantAccountId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function syncEditableApplicationsForPremises(sql, session, premises) {
  const snapshot = buildApplicationPremisesSnapshot(premises);
  const rows = await sql`
    UPDATE applications
    SET
      premises_name = ${snapshot.premises_name},
      premises_address = ${snapshot.premises_address},
      premises_postcode = ${snapshot.premises_postcode},
      premises_description = ${snapshot.premises_description},
      updated_at = NOW()
    WHERE tenant_id = ${session.tenant_id}
      AND applicant_account_id = ${session.applicant_account_id}
      AND premises_id = ${premises.id}
      AND status IN ('draft', 'awaiting_information')
    RETURNING id
  `;

  for (const row of rows) {
    await writeAuditLog(sql, {
      tenantId: session.tenant_id,
      actorType: 'applicant',
      actorId: session.applicant_account_id,
      action: 'application.premises_snapshot_synced',
      recordType: 'application',
      recordId: row.id,
      meta: {
        premises_id: premises.id,
      },
    });
  }

  return rows.map((row) => row.id);
}

async function listPremises(request, env) {
  const session = await requireApplicant(request, env);
  if (!session) return error('Not authenticated', 401);

  const sql = getDb(env);
  const rows = await sql`
    SELECT
      p.*,
      COUNT(a.id)::int AS application_count
    FROM premises p
    LEFT JOIN applications a
      ON a.premises_id = p.id
      AND a.tenant_id = p.tenant_id
    WHERE p.tenant_id = ${session.tenant_id}
      AND p.applicant_account_id = ${session.applicant_account_id}
    GROUP BY p.id
    ORDER BY p.updated_at DESC, p.created_at DESC
  `;

  return json({ premises: rows.map(serialisePremises) });
}

async function createPremises(request, env) {
  const session = await requireApplicant(request, env);
  if (!session) return error('Not authenticated', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const premises = normalisePremisesPayload(body);
  const validationError = validatePremisesPayload(premises);
  if (validationError) return error(validationError);

  const sql = getDb(env);
  const rows = await sql`
    INSERT INTO premises (
      tenant_id,
      applicant_account_id,
      premises_name,
      address_line_1,
      address_line_2,
      town_or_city,
      postcode,
      premises_description
    )
    VALUES (
      ${session.tenant_id},
      ${session.applicant_account_id},
      ${premises.premises_name},
      ${premises.address_line_1},
      ${premises.address_line_2},
      ${premises.town_or_city},
      ${premises.postcode},
      ${premises.premises_description}
    )
    RETURNING *
  `;

  const created = rows[0];

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: 'applicant',
    actorId: session.applicant_account_id,
    action: 'premises.created',
    recordType: 'premises',
    recordId: created.id,
    meta: {
      premises_name: created.premises_name,
      postcode: created.postcode,
    },
  });

  return json(serialisePremises(created), 201);
}

async function getPremises(request, env, premisesId) {
  const session = await requireApplicant(request, env);
  if (!session) return error('Not authenticated', 401);

  const sql = getDb(env);
  const premises = await getOwnedPremises(sql, session.tenant_id, session.applicant_account_id, premisesId);
  if (!premises) return error('Not found', 404);

  const applicationCountRows = await sql`
    SELECT COUNT(*)::int AS application_count
    FROM applications
    WHERE tenant_id = ${session.tenant_id}
      AND applicant_account_id = ${session.applicant_account_id}
      AND premises_id = ${premisesId}
  `;

  return json({
    ...serialisePremises(premises),
    application_count: applicationCountRows[0]?.application_count ?? 0,
  });
}

async function updatePremises(request, env, premisesId) {
  const session = await requireApplicant(request, env);
  if (!session) return error('Not authenticated', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const premises = normalisePremisesPayload(body);
  const validationError = validatePremisesPayload(premises);
  if (validationError) return error(validationError);

  const sql = getDb(env);
  const existing = await getOwnedPremises(sql, session.tenant_id, session.applicant_account_id, premisesId);
  if (!existing) return error('Not found', 404);

  const rows = await sql`
    UPDATE premises
    SET
      premises_name = ${premises.premises_name},
      address_line_1 = ${premises.address_line_1},
      address_line_2 = ${premises.address_line_2},
      town_or_city = ${premises.town_or_city},
      postcode = ${premises.postcode},
      premises_description = ${premises.premises_description},
      updated_at = NOW()
    WHERE id = ${premisesId}
      AND tenant_id = ${session.tenant_id}
      AND applicant_account_id = ${session.applicant_account_id}
    RETURNING *
  `;

  const updated = rows[0];
  const syncedApplicationIds = await syncEditableApplicationsForPremises(sql, session, updated);

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: 'applicant',
    actorId: session.applicant_account_id,
    action: 'premises.updated',
    recordType: 'premises',
    recordId: updated.id,
    meta: {
      premises_name: updated.premises_name,
      postcode: updated.postcode,
      synced_application_ids: syncedApplicationIds,
    },
  });

  return json(serialisePremises(updated));
}

async function deletePremises(request, env, premisesId) {
  const session = await requireApplicant(request, env);
  if (!session) return error('Not authenticated', 401);

  const sql = getDb(env);
  const premises = await getOwnedPremises(sql, session.tenant_id, session.applicant_account_id, premisesId);
  if (!premises) return error('Not found', 404);

  const linkedRows = await sql`
    SELECT COUNT(*)::int AS application_count
    FROM applications
    WHERE tenant_id = ${session.tenant_id}
      AND applicant_account_id = ${session.applicant_account_id}
      AND premises_id = ${premisesId}
  `;

  if ((linkedRows[0]?.application_count ?? 0) > 0) {
    return error('Premises with linked applications cannot be deleted', 409);
  }

  await sql`
    DELETE FROM premises
    WHERE id = ${premisesId}
      AND tenant_id = ${session.tenant_id}
      AND applicant_account_id = ${session.applicant_account_id}
  `;

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: 'applicant',
    actorId: session.applicant_account_id,
    action: 'premises.deleted',
    recordType: 'premises',
    recordId: premisesId,
    meta: {
      premises_name: premises.premises_name,
      postcode: premises.postcode,
    },
  });

  return json({ deleted: true });
}

export async function handlePremisesRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'GET' && url.pathname === '/api/premises') {
    return listPremises(request, env);
  }

  if (method === 'POST' && url.pathname === '/api/premises') {
    return createPremises(request, env);
  }

  const detailMatch = url.pathname.match(/^\/api\/premises\/([^/]+)$/);
  if (detailMatch) {
    const premisesId = detailMatch[1];
    if (method === 'GET') return getPremises(request, env, premisesId);
    if (method === 'PUT') return updatePremises(request, env, premisesId);
    if (method === 'DELETE') return deletePremises(request, env, premisesId);
  }

  return null;
}
