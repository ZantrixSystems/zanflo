-- Migration: 0011_create_tenant_onboarding_requests
-- Created: 2026-04-15
-- Scope: Controlled council onboarding request intake from zanflo.com
--
-- This is NOT self-service tenant provisioning.
-- It stores platform-level onboarding requests for later platform admin review.

CREATE TABLE tenant_onboarding_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_name   TEXT        NOT NULL,
  contact_name        TEXT        NOT NULL,
  work_email          TEXT        NOT NULL,
  requested_subdomain TEXT        NOT NULL,
  message             TEXT,
  status              TEXT        NOT NULL DEFAULT 'pending'
                      CONSTRAINT tenant_onboarding_requests_status_check
                      CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_onboarding_requests_status
  ON tenant_onboarding_requests (status, created_at DESC);

CREATE INDEX idx_tenant_onboarding_requests_subdomain
  ON tenant_onboarding_requests (requested_subdomain);
