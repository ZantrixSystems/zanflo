-- Migration: 0007_update_applications_for_applicant_and_type
-- Created: 2026-04-14
-- Scope: Link applications to applicant accounts and application types
--
-- Changes:
-- 1. Add application_type_id — required, links to the type catalogue
-- 2. Add applicant_account_id — nullable for now (legacy flat rows), required going forward
-- 3. Add status values for the full lifecycle (previously only draft/submitted)
-- 4. Add contact_name, contact_email, contact_phone (separate from applicant identity —
--    a solicitor or agent may be the contact, not the applicant)
-- 5. Add premises_postcode for address precision
--
-- Note on applicant_account_id being nullable:
-- The existing test rows in dev have no account. Rather than block the migration
-- with a NOT NULL constraint against existing data, we allow null but enforce
-- NOT NULL at the application layer going forward. A future migration can
-- harden this once all legacy rows are cleaned up.
--
-- Note on status expansion:
-- We drop the old check constraint and add the full lifecycle.
-- This does NOT change existing row values — draft and submitted are still valid.

-- Add new columns
ALTER TABLE applications
  ADD COLUMN application_type_id  UUID REFERENCES application_types(id),
  ADD COLUMN applicant_account_id UUID REFERENCES applicant_accounts(id),
  ADD COLUMN contact_name         TEXT,
  ADD COLUMN contact_email        TEXT,
  ADD COLUMN contact_phone        TEXT,
  ADD COLUMN premises_postcode    TEXT;

-- Expand status check to full lifecycle
ALTER TABLE applications
  DROP CONSTRAINT applications_status_check;

ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN (
    'draft',
    'submitted',
    'under_review',
    'awaiting_information',
    'approved',
    'refused'
  ));

-- Index for applicant's own applications (the most common query pattern)
CREATE INDEX idx_applications_applicant_account ON applications (tenant_id, applicant_account_id);
CREATE INDEX idx_applications_type ON applications (application_type_id);
