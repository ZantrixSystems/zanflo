-- Migration: 0010_encrypt_application_applicant_phone_spike
-- Created: 2026-04-15
-- Scope: Application-layer encryption spike for applications.applicant_phone
--
-- This migration does NOT introduce database-at-rest CMEK.
-- It adds only the metadata needed for a backend-managed, Google KMS-backed
-- proof of encryption for a single field.
--
-- applicant_phone continues to exist as the application-facing column, but
-- new writes will store ciphertext in that column when the backend
-- marks the row with the encryption scheme below.
--
-- Existing plaintext dev rows are intentionally not bulk-mutated here.
-- The backend preserves backward compatibility for rows with no encryption
-- scheme metadata, so the spike stays safe and reversible.

ALTER TABLE applications
  ADD COLUMN applicant_phone_kms_key_name     TEXT,
  ADD COLUMN applicant_phone_kms_key_version  TEXT,
  ADD COLUMN applicant_phone_encryption_scheme TEXT;

ALTER TABLE applications
  ADD CONSTRAINT applications_applicant_phone_encryption_scheme_check
  CHECK (
    applicant_phone_encryption_scheme IS NULL
    OR applicant_phone_encryption_scheme IN ('gcp_kms_direct_v1')
  );
