-- Migration: 0001_create_applications
-- Created: 2026-04-08
-- Scope: First vertical slice — applicant creates, saves, and submits a premises licence application

CREATE TABLE applications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL,
  applicant_name   TEXT        NOT NULL,
  applicant_email  TEXT        NOT NULL,
  applicant_phone  TEXT,
  premises_name    TEXT        NOT NULL,
  premises_address TEXT        NOT NULL,
  premises_description TEXT,
  status           TEXT        NOT NULL DEFAULT 'draft'
                               CONSTRAINT applications_status_check
                               CHECK (status IN ('draft', 'submitted')),
  submitted_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT submitted_at_only_when_submitted
    CHECK (
      (status = 'submitted' AND submitted_at IS NOT NULL)
      OR
      (status = 'draft' AND submitted_at IS NULL)
    )
);

CREATE INDEX idx_applications_tenant_id ON applications (tenant_id);
CREATE INDEX idx_applications_tenant_status ON applications (tenant_id, status);
