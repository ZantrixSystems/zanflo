-- Migration: 0015_create_decisions
-- Created: 2026-04-17
-- Scope: Decision records for request information / approve / refuse

CREATE TABLE decisions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES tenants(id),
  application_id     UUID        NOT NULL REFERENCES applications(id),
  decided_by_user_id UUID        NOT NULL REFERENCES users(id),
  decision_type      TEXT        NOT NULL
                     CONSTRAINT decisions_type_check
                     CHECK (decision_type IN ('approve', 'refuse', 'request_information')),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decisions_tenant_application
  ON decisions (tenant_id, application_id, created_at DESC);

CREATE INDEX idx_decisions_decided_by
  ON decisions (decided_by_user_id, created_at DESC);
