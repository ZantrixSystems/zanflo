-- Migration: 0006_create_audit_logs
-- Created: 2026-04-14
-- Scope: Immutable audit log — all mutations must write here
--
-- Rules:
-- - No deletes, no updates — append only
-- - actor_type distinguishes staff users from applicant accounts
-- - actor_id is nullable to support system-level actions
-- - record_type + record_id identify what was affected
-- - meta is a JSON blob for action-specific context (field changes, etc.)
-- - tenant_id is nullable only for platform-level actions

CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        REFERENCES tenants(id),
  actor_type  TEXT        NOT NULL
              CONSTRAINT audit_actor_type_check
              CHECK (actor_type IN ('applicant', 'officer', 'manager', 'tenant_admin', 'platform_admin', 'system')),
  actor_id    UUID,
  action      TEXT        NOT NULL,
  record_type TEXT        NOT NULL,
  record_id   UUID        NOT NULL,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_id   ON audit_logs (tenant_id);
CREATE INDEX idx_audit_logs_record      ON audit_logs (record_type, record_id);
CREATE INDEX idx_audit_logs_actor       ON audit_logs (actor_type, actor_id);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs (created_at);
