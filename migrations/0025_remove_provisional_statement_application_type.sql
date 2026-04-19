-- Migration: 0025_remove_provisional_statement_application_type
-- Created: 2026-04-19
-- Scope: Remove Provisional Statement from the platform application type catalogue
--
-- Rationale:
--   The MVP application types for this platform are:
--     - Premises Licence
--     - Late Night Refreshment
--
--   Provisional Statement is a specialist type that requires a different
--   verification model (premises under construction / not yet operational).
--   It is not part of the MVP scope and including it causes confusion in
--   the applicant journey and officer case queue.
--
--   This migration:
--   1. Deletes any tenant_enabled_application_types rows referencing it
--   2. Deletes any application_type_versions rows referencing it
--   3. Deletes the provisional_statement row from application_types
--
--   Any applications that reference this type will have their type link
--   set to NULL via ON DELETE SET NULL (not CASCADE) — this is the safe
--   path for an immutable audit trail. No application records are deleted.
--
-- NOTE: applications.application_type_id has no ON DELETE clause in 0001.
--   We add a safe guard here: update the FK to SET NULL before deleting.
--   If no applications reference this type, this is a no-op.

-- Step 1: Nullify application type references on any applications using this type
UPDATE applications
SET application_type_id = NULL,
    application_type_version_id = NULL
WHERE application_type_id IN (
  SELECT id FROM application_types WHERE slug = 'provisional_statement'
);

-- Step 2: Remove tenant enablements
DELETE FROM tenant_enabled_application_types
WHERE application_type_id IN (
  SELECT id FROM application_types WHERE slug = 'provisional_statement'
);

-- Step 3: Remove type versions
DELETE FROM application_type_versions
WHERE application_type_id IN (
  SELECT id FROM application_types WHERE slug = 'provisional_statement'
);

-- Step 4: Remove the type itself
DELETE FROM application_types
WHERE slug = 'provisional_statement';
