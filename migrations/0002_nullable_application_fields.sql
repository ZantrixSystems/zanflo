-- Migration: 0002_nullable_application_fields
-- Created: 2026-04-08
-- Scope: Remove NOT NULL constraints from applicant and premises fields.
--        Required field validation is enforced at the application layer on submit only.

ALTER TABLE applications
  ALTER COLUMN applicant_name   DROP NOT NULL,
  ALTER COLUMN applicant_email  DROP NOT NULL,
  ALTER COLUMN premises_name    DROP NOT NULL,
  ALTER COLUMN premises_address DROP NOT NULL;
