import { getDb } from '../db/client.js';
import { writeAuditLog } from '../lib/audit.js';
import { requireTenantStaff } from '../lib/guards.js';
import {
  isKnownApplicationSetupField,
  mergeApplicationFieldSettings,
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

async function requireTenantAdmin(request, env) {
  return requireTenantStaff(request, env, 'tenant_admin');
}

async function loadApplicationSetup(sql, tenantId) {
  const [tenantRows, settingsRows, fieldRows] = await Promise.all([
    sql`
      SELECT
        at.id,
        at.slug,
        at.name,
        at.description,
        true AS enabled
      FROM tenant_enabled_application_types teat
      INNER JOIN application_types at ON at.id = teat.application_type_id
      WHERE teat.tenant_id = ${tenantId}
      ORDER BY at.name ASC
    `,
    sql`
      SELECT application_intro_text, applicant_guidance_text
      FROM tenant_application_settings
      WHERE tenant_id = ${tenantId}
      LIMIT 1
    `,
    sql`
      SELECT
        field_key,
        label_override,
        help_text,
        enabled,
        required,
        sensitive
      FROM tenant_application_field_settings
      WHERE tenant_id = ${tenantId}
        AND application_type_key = 'premises_licence'
      ORDER BY field_key ASC
    `,
  ]);

  return {
    enabled_application_types: tenantRows,
    copy: {
      application_intro_text: settingsRows[0]?.application_intro_text ?? '',
      applicant_guidance_text: settingsRows[0]?.applicant_guidance_text ?? '',
    },
    field_settings: mergeApplicationFieldSettings(fieldRows),
  };
}

async function getApplicationSetup(request, env) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);

  const sql = getDb(env);
  const setup = await loadApplicationSetup(sql, session.tenant_id);
  return json({ setup });
}

async function updateApplicationSetup(request, env) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const applicationIntroText = body.copy?.application_intro_text?.trim() || null;
  const applicantGuidanceText = body.copy?.applicant_guidance_text?.trim() || null;
  const fieldSettings = Array.isArray(body.field_settings) ? body.field_settings : [];

  for (const field of fieldSettings) {
    if (!isKnownApplicationSetupField(field.field_key)) {
      return error(`Unknown application setup field: ${field.field_key}`);
    }
  }

  const sql = getDb(env);

  await sql`
    INSERT INTO tenant_application_settings (
      tenant_id,
      application_intro_text,
      applicant_guidance_text
    )
    VALUES (
      ${session.tenant_id},
      ${applicationIntroText},
      ${applicantGuidanceText}
    )
    ON CONFLICT (tenant_id) DO UPDATE
    SET
      application_intro_text = EXCLUDED.application_intro_text,
      applicant_guidance_text = EXCLUDED.applicant_guidance_text,
      updated_at = NOW()
  `;

  if (fieldSettings.length > 0) {
    for (const field of fieldSettings) {
      await sql`
        INSERT INTO tenant_application_field_settings (
          tenant_id,
          application_type_key,
          field_key,
          label_override,
          help_text,
          enabled,
          required,
          sensitive
        )
        VALUES (
          ${session.tenant_id},
          'premises_licence',
          ${field.field_key},
          ${field.label_override?.trim() || null},
          ${field.help_text?.trim() || null},
          ${field.enabled !== false},
          ${field.required === true},
          ${field.sensitive === true}
        )
        ON CONFLICT (tenant_id, application_type_key, field_key) DO UPDATE
        SET
          label_override = EXCLUDED.label_override,
          help_text = EXCLUDED.help_text,
          enabled = EXCLUDED.enabled,
          required = EXCLUDED.required,
          sensitive = EXCLUDED.sensitive,
          updated_at = NOW()
      `;
    }
  }

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: 'tenant_admin',
    actorId: session.user_id,
    action: 'tenant.application_setup.updated',
    recordType: 'tenant',
    recordId: session.tenant_id,
    meta: {
      updated_field_keys: fieldSettings.map((field) => field.field_key),
      has_application_intro_text: Boolean(applicationIntroText),
      has_applicant_guidance_text: Boolean(applicantGuidanceText),
    },
  });

  const setup = await loadApplicationSetup(sql, session.tenant_id);
  return json({ setup });
}

export async function handleAdminApplicationSetupRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'GET' && url.pathname === '/api/admin/application-setup') {
    return getApplicationSetup(request, env);
  }

  if (method === 'PUT' && url.pathname === '/api/admin/application-setup') {
    return updateApplicationSetup(request, env);
  }

  return null;
}
