-- Migration: 0004_create_applicant_accounts
-- Created: 2026-04-14
-- Scope: Public applicant identity — separate from staff users
--
-- Applicant accounts are public-facing identities.
-- They are NOT the same as users (staff). Mixing these would
-- create a security and role boundary violation.
-- Applicants are scoped to a tenant — a person applying to
-- council A cannot log in to council B with the same account.

CREATE TABLE applicant_accounts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id),
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  full_name     TEXT        NOT NULL,
  phone         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Email must be unique per tenant (same person can apply to two councils)
  CONSTRAINT applicant_accounts_tenant_email_unique UNIQUE (tenant_id, email)
);

CREATE INDEX idx_applicant_accounts_tenant_id ON applicant_accounts (tenant_id);
CREATE INDEX idx_applicant_accounts_email     ON applicant_accounts (email);
