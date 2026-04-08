-- Migration: 0003_create_tenants_users_memberships
-- Created: 2026-04-08
-- Scope: Auth and tenant foundation — tenants, users, memberships

CREATE TABLE tenants (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT        NOT NULL UNIQUE,
  password_hash     TEXT        NOT NULL,
  full_name         TEXT        NOT NULL,
  is_platform_admin BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memberships (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id),
  user_id    UUID        NOT NULL REFERENCES users(id),
  role       TEXT        NOT NULL
             CONSTRAINT memberships_role_check
             CHECK (role IN ('tenant_admin', 'manager', 'officer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT memberships_tenant_user_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_memberships_tenant_id ON memberships (tenant_id);
CREATE INDEX idx_memberships_user_id   ON memberships (user_id);
