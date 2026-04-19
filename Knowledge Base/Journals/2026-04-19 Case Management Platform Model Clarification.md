# 2026-04-19 Case Management Platform Model Clarification

## Summary

Systematic clarification pass to align the platform more clearly with its intended model as a **council licensing case management system**. Covers doctrine, data model confirmation, resident journey redesign, officer view improvements, and removal of out-of-scope application type.

---

## Changes Made

### 1. New Doctrine: CASE_MANAGEMENT_PLATFORM_MODEL.md

Created a new doctrine file confirming the intended platform model:

- Resident account → premises → premises verification → downstream applications
- MVP application types: Premises Licence + Late Night Refreshment only
- Structured filtering as core design direction with documented minimum column and filter sets
- Saved filter model documented
- Application type versioning architecture confirmed
- Future dynamic form builder direction noted but explicitly deferred

### 2. Migration 0025 — Remove Provisional Statement

`provisional_statement` application type removed from the platform catalogue.

Rationale:
- Specialist type that does not follow the standard premises verification model (premises under construction)
- Causes confusion in the applicant journey (applicant tries to apply without a verified premises)
- Not needed for MVP
- Any applications referencing this type have `application_type_id` SET NULL (safe — no records deleted)

Files:
- `migrations/0025_remove_provisional_statement_application_type.sql`

### 3. Seed Script — MVP Types Only

`seed-riverside15.js` updated to enable only `premises_licence` and `late_night_refreshment`.

Previously it enabled all `is_active = true` types — which would have included `provisional_statement` before migration 0025 cleaned it up.

### 4. Dashboard Redesign — Premises-First

`DashboardPage.jsx` rewritten from an application-list view to a **premises-first view**.

Before: flat list of applications, no premises grouping, no verification context.

After:
- Page header with "Welcome {name}" + action buttons
- Each premises shown as a card
- Verification status badge per premises
- Inline contextual notice per verification state (unverified, pending, info required, refused)
- Applications grouped under their premises, showing type + status + date
- "New application" button available on verified premises cards
- Empty state when no premises yet

This makes the account → premises → applications model visible to residents, not just implied.

New CSS: `.dashboard-page-header`, `.dashboard-premises-card`, `.dashboard-application-row`, `.dashboard-premises-notice`, notice modifiers, etc.

### 5. Admin Application Detail — Premises Context

`AdminApplicationDetailPage.jsx` updates:

- Breadcrumb: "Applications" → "Cases" (with link to `/admin/cases`)
- Back link: "Back to applications" → "Back to cases"
- "Linked premises record" section now includes `verification_state` of the live premises
- Added hint explaining snapshot vs live data relationship
- Added "View premises verification case →" link so officers can navigate directly between the application and its premises verification case
- Added "Applicant account" section showing name and email
- Backend (`admin-applications.js` `loadApplicationForTenant`): added `p.verification_state AS linked_premises_verification_state` and `aa.phone AS applicant_account_phone` to the detail query

---

## Decisions

**Remove Provisional Statement:** Not a soft deprecation — hard delete from the catalogue. The migration handles the cleanup safely. Any future reinstatement would require a new migration.

**Premises-first dashboard:** The old application-list dashboard was technically correct but did not surface the platform model clearly. Residents could not see which premises each application related to without clicking through.

**Doctrine-first recording:** All of the above is now documented in `CASE_MANAGEMENT_PLATFORM_MODEL.md` as the authoritative reference for this design direction.

---

## Risks / Caveats

- Migration 0025 sets `application_type_id = NULL` on any applications that used `provisional_statement`. This is the safe path. If any such applications exist in production, they will appear in the queue without a type name.
- The dashboard redesign assumes `premises_id` is always set on applications. The orphan application fallback handles the edge case.
- `aa.phone` is added to the detail query — this is the decrypted/plaintext value. If phone encryption (KMS, migration 0010) is active, `serialiseApplicationForResponse` handles decryption before the response is sent.

---

## Deferred

- Dynamic form builder per application type
- Manager-signoff enforcement (`review_mode` column present but not enforced)
- Full JQL-style filter query language (current: AND-only simple filter)
- Cross-premises application grouping in officer view (officer sees by case, not by premises)
- Applicant phone display in officer detail view (field added to query, not yet rendered)

Confidence Level: High
