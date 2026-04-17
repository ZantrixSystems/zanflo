-- Migration: 0018_premises_and_tenant_application_setup
-- Created: 2026-04-17
-- Scope: Introduce reusable applicant-owned premises and the first tenant-owned
-- application setup foundation.

CREATE TABLE premises (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id),
  applicant_account_id UUID        NOT NULL REFERENCES applicant_accounts(id),
  premises_name        TEXT        NOT NULL,
  address_line_1       TEXT        NOT NULL,
  address_line_2       TEXT,
  town_or_city         TEXT,
  postcode             TEXT        NOT NULL,
  premises_description TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT premises_owner_unique_key UNIQUE (id, tenant_id, applicant_account_id)
);

CREATE INDEX idx_premises_tenant_applicant
  ON premises (tenant_id, applicant_account_id, updated_at DESC);

ALTER TABLE applications
  ADD COLUMN premises_id UUID;

ALTER TABLE applications
  ADD CONSTRAINT applications_premises_owner_fk
  FOREIGN KEY (premises_id, tenant_id, applicant_account_id)
  REFERENCES premises (id, tenant_id, applicant_account_id)
  ON DELETE RESTRICT;

CREATE INDEX idx_applications_premises
  ON applications (tenant_id, premises_id);

WITH distinct_premises AS (
  SELECT DISTINCT
    a.tenant_id,
    a.applicant_account_id,
    a.premises_name,
    a.premises_address,
    a.premises_postcode,
    a.premises_description
  FROM applications a
  WHERE a.applicant_account_id IS NOT NULL
    AND NULLIF(TRIM(a.premises_name), '') IS NOT NULL
    AND NULLIF(TRIM(a.premises_address), '') IS NOT NULL
    AND NULLIF(TRIM(a.premises_postcode), '') IS NOT NULL
),
inserted_premises AS (
  INSERT INTO premises (
    tenant_id,
    applicant_account_id,
    premises_name,
    address_line_1,
    address_line_2,
    town_or_city,
    postcode,
    premises_description
  )
  SELECT
    dp.tenant_id,
    dp.applicant_account_id,
    dp.premises_name,
    dp.premises_address,
    NULL,
    NULL,
    dp.premises_postcode,
    dp.premises_description
  FROM distinct_premises dp
  RETURNING id
)
SELECT COUNT(*) FROM inserted_premises;

UPDATE applications a
SET premises_id = p.id
FROM premises p
WHERE a.premises_id IS NULL
  AND a.applicant_account_id IS NOT NULL
  AND p.tenant_id = a.tenant_id
  AND p.applicant_account_id = a.applicant_account_id
  AND p.premises_name = a.premises_name
  AND p.address_line_1 = a.premises_address
  AND p.postcode = a.premises_postcode
  AND COALESCE(p.premises_description, '') = COALESCE(a.premises_description, '');

CREATE TABLE tenant_application_settings (
  tenant_id                UUID        PRIMARY KEY REFERENCES tenants(id),
  application_intro_text   TEXT,
  applicant_guidance_text  TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tenant_application_field_settings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id),
  application_type_key TEXT        NOT NULL,
  field_key            TEXT        NOT NULL,
  label_override       TEXT,
  help_text            TEXT,
  enabled              BOOLEAN     NOT NULL DEFAULT TRUE,
  required             BOOLEAN     NOT NULL DEFAULT FALSE,
  sensitive            BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_application_field_settings_unique
    UNIQUE (tenant_id, application_type_key, field_key)
);

CREATE INDEX idx_tenant_application_field_settings_tenant
  ON tenant_application_field_settings (tenant_id, application_type_key);
