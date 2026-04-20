# 2026-04-20 Premises Licence Case Model Refactor

**Phase:** Phase 5 — MVP Build  
**Confidence Level:** High  
**Scope:** Major domain model simplification — new primary case entity

---

## Summary

Refactored the platform from a "multiple applications per premises" model to a "one premises licence case per premises" model. This is a deliberate MVP simplification that aligns with how UK council licensing actually works: one master record per site, not a stream of independent application records.

---

## Domain decisions

### 1. One case per premises (confirmed MVP model)

**Decision:** Each `premises` record has exactly one `premise_licence_case`. Subsequent changes to a licensed case bring it back into review — they do NOT create new independent case records.

**Rationale:**
- Simpler for applicants to manage
- Officers work one case per site, not a queue of disconnected items per site
- History (events, decisions, information requests) stays attached to the same case
- Aligned to UK licensing law: a premises has a licence record, not a stream of application records

**Enforced by:** `UNIQUE (premises_id, tenant_id)` constraint on `premise_licence_cases`

---

### 2. Licence sections replace application types as the module concept

**Decision:** A `licence_section_definition` is the configurable unit within a case. Tenant admins (or managers) define which sections are available. Applicants tick which sections apply to their premises.

**Rationale:**
- Application types (premises_licence, late_night_refreshment) were acting as independent case types — wrong model
- Sections are additive within one case, not separate cases
- Sections have simple structured fields — NOT a full form builder

**Fields model:** `[{ key, label, type (text|textarea|boolean), required }]` stored as JSONB on the section definition. Answers stored as `{ [field_key]: value }` JSONB on `case_selected_sections`.

---

### 3. Status lifecycle (fixed in code, not configurable)

```
draft → submitted → under_review → awaiting_information
                                 → waiting_on_officer → under_review (loop)
                 → verified → under_consultation → licensed | refused
```

Modifications to a `licensed` or `refused` case:
- Applicant edits and re-submits → status resets to `submitted`
- `last_modified_at` is stamped → case re-appears in officer queue
- Full history preserved on the same case

---

### 4. Case events as unified timeline

`case_events` table replaces the synthetic timeline built from `decisions` + `submitted_at` + `assigned_at` columns. All events — status changes, information requests, officer notes, applicant responses — are stored as immutable event rows.

Officer notes (`officer_note` event type) are filtered out from the applicant-facing timeline.

---

### 5. Old tables retained as legacy

`applications`, `decisions`, `premises_verification_events` are NOT dropped. They are preserved until all dev data is migrated and are treated as legacy from this point. The new routes (`/api/cases/*`, `/api/admin/premise-cases/*`) handle all new case work.

`admin-cases.js` (UNION-based queue) is also retained but deprecated for the new model. The new `AdminCasesPage.jsx` queries `/api/admin/premise-cases` instead.

---

## Files changed

### Migrations
- `migrations/0026_premise_licence_cases.sql` — new tables: `licence_section_definitions`, `premise_licence_cases`, `case_selected_sections`, `case_events`

### Backend — new routes
- `src/routes/admin-licence-sections.js` — CRUD for tenant section config
- `src/routes/admin-premise-cases.js` — officer case list, detail, assign, request-info, verify, decision, note, delete
- `src/routes/applicant-cases.js` — applicant create, view, update, submit, respond

### Backend — modified
- `src/index.js` — wired new routes above legacy routes

### Frontend — new pages
- `frontend/src/pages/AdminCaseDetailPage.jsx` — full case detail with timeline, sections, action panels
- `frontend/src/pages/AdminLicenceSectionsPage.jsx` — tenant admin section configurator

### Frontend — rewritten
- `frontend/src/pages/AdminCasesPage.jsx` — new filter model: search (free text), status, assigned, postcode, updated_after, sort
- `frontend/src/pages/DashboardPage.jsx` — premises-first, one case per premises card

### Frontend — updated
- `frontend/src/lib/navigation.js` — removed "Assigned to me" / "Unassigned" nav items; added "Licence sections" link
- `frontend/src/api.js` — all new API methods added
- `frontend/src/App.jsx` — new routes: `/admin/premise-cases/:id`, `/admin/licence-sections`
- `frontend/src/index.css` — CSS for new components (section pills, section card, search input, etc.)

### Seed data
- `scripts/seed-riverside15.js` — fully rewritten for new model; seeds Entertainment + Late Night Refreshment sections; 6 cases with realistic status mix and timeline events

---

## Doctrine to update

- `CASE_MANAGEMENT_PLATFORM_MODEL.md` — update to reflect new case entity and filter model
- `APPLICANT_PREMISES_AND_APPLICATION_SETUP.md` — update to reflect one-case-per-premises rule

---

## What is intentionally deferred

- Applicant case form UI (`/cases/:id`) — applicant can create and submit via API; dedicated form page not yet built
- Email notifications on case events
- PDF export
- Fee calculation
- Shareable case links
- Dropping the `applications` / `premises_verification_events` tables (wait until confirmed unused in production)
