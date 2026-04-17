-- Migration: 0014_add_application_assignment
-- Created: 2026-04-17
-- Scope: Add assignment tracking for staff review workflow

ALTER TABLE applications
  ADD COLUMN assigned_user_id UUID REFERENCES users(id),
  ADD COLUMN assigned_at TIMESTAMPTZ;

CREATE INDEX idx_applications_tenant_status_updated
  ON applications (tenant_id, status, updated_at DESC);

CREATE INDEX idx_applications_tenant_assigned_user
  ON applications (tenant_id, assigned_user_id);
