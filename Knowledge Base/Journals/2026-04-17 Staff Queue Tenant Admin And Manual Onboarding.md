# 2026-04-17 Staff Queue Tenant Admin And Manual Onboarding

Confidence Level: High

## Summary

Implemented MVP slices 8 to 11 on top of the previously hardened host-based runtime:

- tenant staff review queue under `/admin`
- decision workflow with decision records and audited transitions
- tenant admin users, settings, and audit views
- platform manual tenant onboarding and initial tenant admin issuance

## Backend

- Added tenant staff/admin routes for:
  - `GET /api/admin/applications`
  - `GET /api/admin/applications/:id`
  - `POST /api/admin/applications/:id/assign`
  - `POST /api/admin/applications/:id/request-information`
  - `POST /api/admin/applications/:id/decision`
  - `GET /api/admin/users`
  - `POST /api/admin/users`
  - `PUT /api/admin/users/:id`
  - `GET /api/admin/settings`
  - `PUT /api/admin/settings`
  - `GET /api/admin/audit`
- Kept tenant scope enforcement at the backend query level using the resolved tenant from staff session context.
- Kept audit writes on all mutations in these slices.
- Reused platform admin routes for manual onboarding and kept them platform-host gated only.

## Database

- Added `0014_add_application_assignment.sql`
  - application assignment fields and indexes
- Added `0015_create_decisions.sql`
  - fixed decisions table for approve/refuse/request-information records
- Added `0016_expand_application_submission_constraint.sql`
  - allows applicant resubmission after `awaiting_information`

## Frontend

- Added tenant admin workspace pages:
  - dashboard
  - applications list
  - application detail
  - users
  - settings
  - audit
- Added platform admin pages:
  - tenant list
  - tenant create
  - tenant detail
  - initial tenant admin issue
- Updated host-aware frontend routing so active runtime now matches:
  - `zanflo.com`
  - `platform.zanflo.com`
  - `<tenant>.zanflo.com`
  - `<tenant>.zanflo.com/admin`
- Updated applicant application page so `awaiting_information` can be edited and resubmitted.

## Verification

- `npm --prefix frontend run build` passed
- `npm test` passed
- Confirmed self-service tenant onboarding remains out of the active runtime path
- Confirmed manual tenant onboarding remains the MVP route

## Final Verification Pass

- Rechecked workflow transitions, audit coverage, tenant isolation, and runtime hygiene against the roadmap-aligned MVP model.
- Tightened review-queue permissions so `tenant_admin` no longer processes applications directly.
- Tightened assignment so an officer cannot take an application already assigned to a different officer; manager reassignment remains allowed.
- Extended integration coverage for those permission boundaries.
- Re-ran:
  - `npm test`
  - `npm --prefix frontend run build`
