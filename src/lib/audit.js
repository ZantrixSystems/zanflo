/**
 * Audit log helper.
 *
 * Every mutation in the system must call writeAuditLog.
 * Failures should NOT silently swallow — log them but do not block
 * the main operation (audit loss is bad; blocking the user is worse).
 *
 * Usage:
 *   await writeAuditLog(sql, {
 *     tenantId:   session.tenant_id,
 *     actorType:  'applicant',
 *     actorId:    session.applicant_account_id,
 *     action:     'application.created',
 *     recordType: 'application',
 *     recordId:   application.id,
 *     meta:       { application_type_id },
 *   });
 */

export async function writeAuditLog(sql, {
  tenantId,
  actorType,
  actorId,
  action,
  recordType,
  recordId,
  meta = null,
}) {
  try {
    await sql`
      INSERT INTO audit_logs (tenant_id, actor_type, actor_id, action, record_type, record_id, meta)
      VALUES (
        ${tenantId ?? null},
        ${actorType},
        ${actorId ?? null},
        ${action},
        ${recordType},
        ${recordId},
        ${meta ? JSON.stringify(meta) : null}
      )
    `;
  } catch (err) {
    // Audit log failure must be visible in logs but must not block the caller.
    console.error('[audit] Failed to write audit log:', err, {
      actorType, actorId, action, recordType, recordId,
    });
  }
}
