# 2026-04-08 First Vertical Slice — Schema and API

**Phase:** Phase 2 (Domain Data Design) — first task
**Vertical slice:** Applicant creates, saves, and submits a premises licence application (general section only)
**Confidence Level:** High

---

## What was built

### Migration: `migrations/001_create_applications.sql`

- Created `applications` table with UUID primary key and `tenant_id` (not null, indexed)
- Status constrained to `('draft', 'submitted')` via CHECK constraint
- Database-level invariant: `submitted_at` must be NULL when draft, NOT NULL when submitted
- Two indexes: `tenant_id` alone, and `(tenant_id, status)` for filtered list queries later

### Worker API: `src/routes/applications.js`

| Route | Method | Description |
|---|---|---|
| `/applications` | POST | Create draft application |
| `/applications/:id` | GET | Fetch application (tenant-scoped) |
| `/applications/:id` | PUT | Update draft (submitted applications locked) |
| `/applications/:id/submit` | POST | Validate + transition to submitted |

### Entry point: `src/index.js`

- Minimal fetch handler — routes to `handleApplicationRoutes`, wraps in top-level error catch

### DB client: `src/db/client.js`

- Thin wrapper around `@neondatabase/serverless` `neon()` — one client per request, bound to `DATABASE_URL` env var

---

## Decisions made

- `tenant_id` passed via `X-Tenant-Id` header as a placeholder until auth is implemented. This is intentional and temporary — all queries still enforce `tenant_id` scoping at the DB layer.
- PATCH semantics not used — PUT with `COALESCE` allows partial field updates without full-document replace, keeping client logic simple.
- No soft deletes at this stage — not in scope for vertical slice 1.
- No document attachment — out of scope; documents go to object storage, not the DB.
- Required fields for submission: `applicant_name`, `applicant_email`, `premises_name`, `premises_address`. Phone and description are optional.

---

## Risks and notes

- `X-Tenant-Id` header must be replaced with a verified claim from an auth token before any production exposure — currently it is trusted without verification.
- No rate limiting or input length constraints at this layer — acceptable for MVP build phase, must be addressed before public exposure.
- The `COALESCE` update pattern means passing `null` explicitly will not clear a field. This is intentional for draft-saving partial form data.

---

## Files changed

- `migrations/001_create_applications.sql` — new
- `src/db/client.js` — new
- `src/routes/applications.js` — new
- `src/index.js` — new
