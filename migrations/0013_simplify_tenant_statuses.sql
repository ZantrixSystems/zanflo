-- Migration: 0013_simplify_tenant_statuses
-- Created: 2026-04-16
-- Scope: Simplify tenant lifecycle to MVP-safe runtime states
--
-- New runtime states:
--   pending_setup
--   active
--   suspended
--   disabled

ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_status_check;

UPDATE tenants
SET status = CASE status
  WHEN 'pending_verification' THEN 'pending_setup'
  WHEN 'trial'                THEN 'pending_setup'
  WHEN 'active'               THEN 'active'
  WHEN 'suspended'            THEN 'suspended'
  WHEN 'expired'              THEN 'disabled'
  WHEN 'scheduled_deletion'   THEN 'disabled'
  WHEN 'deleted'              THEN 'disabled'
  ELSE 'disabled'
END;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('pending_setup', 'active', 'suspended', 'disabled'));
