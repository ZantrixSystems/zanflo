-- Migration: 0005_create_application_types
-- Created: 2026-04-14
-- Scope: Application type catalogue + tenant enablement
--
-- application_types is a platform-level catalogue.
-- It defines what types of licence applications exist on the platform.
-- Tenants do not create or modify this catalogue.
--
-- tenant_enabled_application_types controls which types a given
-- tenant has switched on. A council may not offer all types.
-- This is the correct place to gate availability — not hardcoded
-- in the frontend.

CREATE TABLE application_types (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the two application types required for this slice.
-- These are platform-level records — no tenant_id.
INSERT INTO application_types (slug, name, description) VALUES
  ('premises_licence',     'Premises Licence',     'Application for a premises licence under the Licensing Act 2003.'),
  ('provisional_statement','Provisional Statement', 'Application for a provisional statement for premises being built or altered.');

CREATE TABLE tenant_enabled_application_types (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id),
  application_type_id UUID        NOT NULL REFERENCES application_types(id),
  enabled_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tenant_app_type_unique UNIQUE (tenant_id, application_type_id)
);

CREATE INDEX idx_tenant_enabled_app_types_tenant ON tenant_enabled_application_types (tenant_id);
