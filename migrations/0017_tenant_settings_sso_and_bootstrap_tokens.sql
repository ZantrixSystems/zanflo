-- Migration: 0017_tenant_settings_sso_and_bootstrap_tokens
-- Created: 2026-04-17
-- Scope: Demo-ready self-service tenant setup foundation
--
-- Adds:
-- - tenant_settings for branding, public homepage copy, and bootstrap owner tracking
-- - tenant_sso_configs for tenant-scoped SSO configuration persistence
-- - tenant_bootstrap_tokens for one-time apex-to-tenant first login exchange

CREATE TABLE tenant_settings (
  tenant_id                UUID        PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  bootstrap_admin_user_id  UUID        REFERENCES users(id),
  council_display_name     TEXT,
  support_email            TEXT,
  support_phone            TEXT,
  support_contact_name     TEXT,
  internal_admin_name      TEXT,
  internal_admin_email     TEXT,
  logo_url                 TEXT,
  welcome_text             TEXT,
  public_homepage_text     TEXT,
  contact_us_text          TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_settings_bootstrap_admin
  ON tenant_settings (bootstrap_admin_user_id)
  WHERE bootstrap_admin_user_id IS NOT NULL;

INSERT INTO tenant_settings (
  tenant_id,
  council_display_name,
  support_email,
  support_contact_name,
  internal_admin_email
)
SELECT
  t.id,
  t.name,
  t.contact_email,
  t.contact_name,
  t.contact_email
FROM tenants t
ON CONFLICT (tenant_id) DO NOTHING;

CREATE TABLE tenant_sso_configs (
  tenant_id                        UUID        PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  saml_enabled                     BOOLEAN     NOT NULL DEFAULT FALSE,
  saml_metadata_xml                TEXT,
  saml_entity_id                   TEXT,
  saml_login_url                   TEXT,
  saml_certificate                 TEXT,
  oidc_enabled                     BOOLEAN     NOT NULL DEFAULT FALSE,
  oidc_client_id                   TEXT,
  oidc_client_secret_ciphertext    TEXT,
  oidc_client_secret_iv            TEXT,
  oidc_client_secret_hint          TEXT,
  oidc_client_secret_scheme        TEXT,
  oidc_client_secret_updated_at    TIMESTAMPTZ,
  oidc_client_secret_id            TEXT,
  oidc_directory_id                TEXT,
  oidc_issuer                      TEXT,
  oidc_authorization_endpoint      TEXT,
  oidc_token_endpoint              TEXT,
  oidc_userinfo_endpoint           TEXT,
  oidc_scopes                      TEXT,
  auth_runtime_status              TEXT        NOT NULL DEFAULT 'configuration_only'
                                    CONSTRAINT tenant_sso_configs_auth_runtime_status_check
                                    CHECK (auth_runtime_status IN ('configuration_only')),
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tenant_sso_configs (tenant_id)
SELECT id
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

CREATE TABLE tenant_bootstrap_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL UNIQUE,
  purpose      TEXT        NOT NULL
               CONSTRAINT tenant_bootstrap_tokens_purpose_check
               CHECK (purpose IN ('tenant_admin_bootstrap')),
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_bootstrap_tokens_lookup
  ON tenant_bootstrap_tokens (tenant_id, user_id, expires_at)
  WHERE used_at IS NULL;
