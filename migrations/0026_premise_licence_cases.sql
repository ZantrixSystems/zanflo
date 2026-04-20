-- Migration: 0026_premise_licence_cases
-- Created: 2026-04-20
-- Scope: Introduce the premise_licence_case as the single primary case entity
--        per premises. Replaces the old "multiple applications per premises" model.
--
-- Design decisions recorded here:
-- 1. One premises → one premise_licence_case (the master case record).
--    Subsequent changes to a licensed case bring it back into review as a
--    modification — they do NOT create a new independent case.
-- 2. Licence sections/modules are stored in case_selected_sections, referencing
--    licence_section_definitions configured per tenant.
-- 3. The status lifecycle is fixed in application code, not configurable:
--    draft → submitted → under_review → awaiting_information
--    → waiting_on_officer → verified → under_consultation
--    → licensed | refused
--    A modification of a licensed case resets to: submitted → under_review → ...
-- 4. case_events is a unified timeline/audit log per case. Comments, status
--    changes, assignments, and decisions are all recorded here.
-- 5. The old `applications` table and `premises_verification_events` table are
--    NOT dropped here — they are preserved for reference until all existing
--    seed/test data is migrated. They are treated as legacy from this point.

-- ============================================================
-- 1. Licence section definitions (tenant-configurable modules)
-- ============================================================
-- Tenant admin or officer defines which licence sections are available.
-- Each section has a slug (immutable key), display name, and structured
-- fields stored as JSONB (simple key/label/type list — NOT a form builder).

CREATE TABLE licence_section_definitions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug          TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  description   TEXT,
  fields        JSONB       NOT NULL DEFAULT '[]',
  -- fields shape: [{ key, label, type (text|boolean|textarea), required }]
  is_enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lsd_tenant_slug_unique UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_lsd_tenant ON licence_section_definitions (tenant_id, is_enabled, display_order);

-- ============================================================
-- 2. Premise licence cases (primary case entity)
-- ============================================================
-- One row per premises. This is the single master case record.
-- Status reflects the current stage of the case lifecycle.

CREATE TABLE premise_licence_cases (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES tenants(id),
  applicant_account_id  UUID        NOT NULL REFERENCES applicant_accounts(id),
  premises_id           UUID        NOT NULL REFERENCES premises(id),

  -- Snapshot of premises details at submission time (denormalised for auditability).
  -- Updated each time the case is re-submitted after modification.
  premises_name         TEXT        NOT NULL,
  address_line_1        TEXT        NOT NULL,
  address_line_2        TEXT,
  town_or_city          TEXT,
  postcode              TEXT        NOT NULL,
  premises_description  TEXT,

  status                TEXT        NOT NULL DEFAULT 'draft'
    CONSTRAINT plc_status_values CHECK (status IN (
      'draft',
      'submitted',
      'under_review',
      'awaiting_information',
      'waiting_on_officer',
      'verified',
      'under_consultation',
      'licensed',
      'refused'
    )),

  -- Assignment
  assigned_user_id      UUID        REFERENCES users(id),
  assigned_at           TIMESTAMPTZ,

  -- Reference number (auto-incrementing, tenant-scoped display ref)
  ref_number            BIGSERIAL   NOT NULL,

  -- Timestamps
  submitted_at          TIMESTAMPTZ,
  last_modified_at      TIMESTAMPTZ, -- set when applicant modifies a licensed case
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One case per premises per tenant
  CONSTRAINT plc_premises_tenant_unique UNIQUE (premises_id, tenant_id)
);

CREATE INDEX idx_plc_tenant_status    ON premise_licence_cases (tenant_id, status, updated_at DESC);
CREATE INDEX idx_plc_tenant_applicant ON premise_licence_cases (tenant_id, applicant_account_id);
CREATE INDEX idx_plc_tenant_assigned  ON premise_licence_cases (tenant_id, assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX idx_plc_premises         ON premise_licence_cases (premises_id, tenant_id);

-- ============================================================
-- 3. Selected sections per case
-- ============================================================
-- Records which licence sections/modules the applicant has selected,
-- and stores their answers to section-specific fields as JSONB.

CREATE TABLE case_selected_sections (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID        NOT NULL REFERENCES tenants(id),
  case_id                     UUID        NOT NULL REFERENCES premise_licence_cases(id) ON DELETE CASCADE,
  section_definition_id       UUID        NOT NULL REFERENCES licence_section_definitions(id),
  section_slug                TEXT        NOT NULL, -- denormalised for query convenience
  answers                     JSONB       NOT NULL DEFAULT '{}',
  -- answers shape: { [field_key]: value }
  selected_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT css_case_section_unique UNIQUE (case_id, section_definition_id)
);

CREATE INDEX idx_css_case ON case_selected_sections (tenant_id, case_id);

-- ============================================================
-- 4. Case events (unified timeline)
-- ============================================================
-- All meaningful events for a case are stored here:
-- status changes, assignments, officer comments, applicant responses,
-- information requests, decisions. This is the audit trail AND the
-- communication thread.

CREATE TABLE case_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id),
  case_id     UUID        NOT NULL REFERENCES premise_licence_cases(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL
    CONSTRAINT ce_event_type_values CHECK (event_type IN (
      'case_created',
      'case_submitted',
      'case_modified',        -- applicant edits a licensed/approved case
      'status_changed',
      'officer_assigned',
      'information_requested',
      'information_provided',
      'section_added',
      'officer_note',         -- internal note, not sent to applicant
      'applicant_message',    -- applicant-authored message
      'decision_made'
    )),
  actor_type  TEXT        NOT NULL
    CONSTRAINT ce_actor_type_values CHECK (actor_type IN (
      'applicant', 'officer', 'manager', 'tenant_admin', 'system'
    )),
  actor_id    UUID,       -- NULL for system events
  payload     JSONB       NOT NULL DEFAULT '{}',
  -- payload shapes by event_type:
  --   status_changed:       { from, to }
  --   officer_assigned:     { user_id, user_name }
  --   information_requested: { notes }
  --   information_provided: { notes }
  --   section_added:        { slug, name }
  --   officer_note:         { body }
  --   applicant_message:    { body }
  --   decision_made:        { decision (licensed|refused), notes }
  --   case_modified:        { previous_status }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ce_case ON case_events (tenant_id, case_id, created_at ASC);
