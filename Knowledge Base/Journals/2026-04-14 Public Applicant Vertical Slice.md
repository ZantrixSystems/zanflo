# 2026-04-14 — Public Applicant Vertical Slice

**Confidence Level: High**
**Phase: 5 — MVP Build**
**Slice: 1 — Auth and tenant foundation → Application submission (public applicant flow)**

---

## What was built

This journal covers the first complete end-to-end public applicant vertical slice.
It extends the prior auth/tenant foundation (0003) with the full applicant journey.

---

## Migrations added

| File | Purpose |
|------|---------|
| `0004_create_applicant_accounts.sql` | Public applicant identity — separate table from `users` (staff) |
| `0005_create_application_types.sql`  | Platform-level licence type catalogue + tenant enablement junction |
| `0006_create_audit_logs.sql`         | Append-only audit table — actor, action, record, meta |
| `0007_update_applications_for_applicant_and_type.sql` | Links applications to applicant accounts and application types; expands status lifecycle; adds contact fields and postcode |

---

## Schema decisions

### applicant_accounts vs users

**Decision:** Applicant accounts are a completely separate table from `users`.

**Rationale:** These are different identity domains. Staff users have membership records, platform roles, and tenant roles. Applicants are public users with no staff access. Mixing them would conflate trust levels and make permission logic fragile. The session cookies are also separate (`applicant_session` vs `session`) to make this boundary explicit.

**Implication:** An applicant cannot accidentally be assigned a staff role. A staff user's email being the same as an applicant's email in the same tenant is not a collision — they are in different tables.

### Applicant accounts are tenant-scoped

**Decision:** `applicant_accounts` has a `UNIQUE (tenant_id, email)` constraint.

**Rationale:** A person may apply to two different councils. Their accounts at each council are separate. This is intentional — there is no cross-tenant identity federation at MVP.

### premises fields stay on applications

**Decision:** Premises details (name, address, postcode, description) are inline on the `applications` table, not in a separate `premises` table.

**Rationale:** At MVP, premises is a form section, not a reusable entity. Normalising it now adds joins without benefit. If/when an applicant can reuse premises across applications (Phase 7 candidate), normalise then.

### contact details are separate from applicant details

**Decision:** Added `contact_name`, `contact_email`, `contact_phone` as distinct fields.

**Rationale:** The person applying and the person the council should contact may differ (e.g. a solicitor submitting on behalf of a client). Conflating these would require the applicant to put agent details in their own name fields — confusing and wrong.

### application_type_id required at creation, not on start

**Decision:** The type is chosen before the application record is created (dashboard → pick type → create).

**Rationale:** An application without a type is semantically invalid. Requiring it at creation enforces this cleanly.

---

## Backend architecture

### Tenant resolution

Staff routes: tenant resolved from JWT session (set at login via membership lookup).

Applicant routes: tenant resolved from `X-Tenant-Slug` header on every request (register, login). After login, tenant is encoded in the `applicant_session` JWT — subsequent requests read from the session, not the header.

**Why header for auth, not URL path or subdomain?**
- URL path (`/tenants/riverside/...`) pollutes all routes and couples frontend routing to tenant.
- Subdomain requires DNS per tenant — not available in dev or early production.
- Header is clean, explicit, and easy to control from the frontend env var.

### Double-scoped queries

Every application query includes both `tenant_id` and `applicant_account_id`. This means:
- An applicant cannot see another applicant's applications (even in the same tenant).
- A tenant cannot see another tenant's applications.
- Both protections are enforced at query level — not application layer.

### Audit logging

Every mutation calls `writeAuditLog`. Failures log but do not block the caller — audit loss is bad but should not break the user operation. This is a pragmatic choice at MVP; a queued audit write would be more robust at scale.

Actions audited:
- `applicant_account.registered`
- `application.created`
- `application.draft_saved`
- `application.submitted`

---

## Frontend architecture

### Framework: Vite + React

No component library. Plain CSS. Reason: a component library adds a dependency surface and opinionated patterns that will fight us as the UI grows. Plain CSS with clear naming is maintainable.

### Routing

| Path | Page | Auth required |
|------|------|--------------|
| `/login` | LoginPage | No |
| `/register` | RegisterPage | No |
| `/dashboard` | DashboardPage | Yes |
| `/applications/:id` | ApplicationPage | Yes |

`RequireAuth` component wraps protected routes. It checks session state from `AuthContext`. If session check is in progress, it renders nothing (avoids flash).

### Session strategy

`AuthContext` calls `/applicant/me` on mount. This is a single lightweight request that rehydrates the session from the `applicant_session` cookie on every page load. The result is stored in React state. No localStorage, no token in the DOM.

### Form design: section-based, not wizard

The general form has three sections (applicant, premises, contact) on one page. This was chosen over a multi-step wizard because:
- The form is short enough to be readable in full.
- A wizard adds navigation state, progress tracking, and validation-per-step complexity.
- The applicant benefits from seeing the full scope before filling anything.

A wizard can be introduced later if form length grows (Phase 7).

### Explicit save — no auto-save

The applicant must click "Save draft". No debounced auto-save. Reason: auto-save requires conflict detection, optimistic UI, and retry handling. These are correct to add later; not at MVP scope. The UX is honest: the button is always visible, and saved status feedback is shown after save.

### Tenant in frontend

`VITE_TENANT_SLUG` in `.env.local` sets the tenant for the frontend. This is sent as `X-Tenant-Slug` on every API request. In a multi-council production deployment, this would be set per-environment or derived from the hostname.

---

## Seed data

`scripts/seed.js` creates:
- 1 tenant: `Riverside Council` (slug: `riverside`)
- Both application types enabled for Riverside
- 1 platform admin user
- 1 officer user with membership to Riverside

Applicant accounts are NOT seeded — they are created via the public registration flow.

---

## What is intentionally NOT built

| Concern | Reason deferred |
|---------|----------------|
| Staff review UI | Phase 5 slice 4 |
| Information request flow | Phase 5 slice 5 |
| Decision recording | Phase 5 slice 6 |
| Email notifications | Phase 5 slice 7 |
| Document upload | Phase 5 slice 9 |
| Council self-service onboarding | Phase 7 |
| Modular application subsections (alcohol, entertainment) | Phase 7 |
| Auto-save | Phase 6/7 quality improvement |
| Multi-tenant switching for applicants | Deferred — unclear if needed |
| Payment handling | Phase 7 |

---

## Risks and gaps identified

### Risk: `applicant_account_id` is nullable on applications

**Why:** Migration 0007 cannot add a NOT NULL constraint against existing test rows that have no account. The column is nullable in the DB but enforced NOT NULL at the application layer (backend refuses to create an application without a session).

**Resolution:** Once dev data is cleaned up, a future migration should add `NOT NULL` to `applicant_account_id`. This should be done before any real tenant is onboarded.

### Risk: CORS is hardcoded to localhost origins

**Why:** CORS allowed origins are hardcoded in `src/index.js` for dev.

**Resolution:** Before production, this must be driven by an environment variable (`ALLOWED_ORIGINS`). Flag this before Phase 6 hardening.

### Risk: No rate limiting on registration or login

**Why:** Cloudflare Workers does not provide built-in rate limiting without paid plans.

**Resolution:** Acceptable at MVP. Must be addressed in Phase 6 before any real tenant is onboarded.

### Gap: No email verification on registration

**Why:** Out of MVP scope. An applicant can register with any email.

**Resolution:** Email verification should be added in Phase 6 or early Phase 7 before real public use.

### Gap: No password reset flow

**Why:** Out of MVP scope.

**Resolution:** Required before public launch. Phase 6 candidate.

---

## Files changed

**Migrations:**
- `migrations/0004_create_applicant_accounts.sql` (new)
- `migrations/0005_create_application_types.sql` (new)
- `migrations/0006_create_audit_logs.sql` (new)
- `migrations/0007_update_applications_for_applicant_and_type.sql` (new)

**Backend:**
- `src/lib/applicant-session.js` (new)
- `src/lib/audit.js` (new)
- `src/routes/applicant-auth.js` (new)
- `src/routes/application-types.js` (new)
- `src/routes/applications.js` (rewritten — session-aware, applicant-scoped)
- `src/index.js` (rewritten — CORS + new route chain)

**Seed:**
- `scripts/seed.js` (extended — application types + officer user)

**Frontend:**
- `frontend/src/api.js` (new)
- `frontend/src/auth-context.jsx` (new)
- `frontend/src/main.jsx` (updated — Router + AuthProvider)
- `frontend/src/App.jsx` (rewritten — React Router routes)
- `frontend/src/index.css` (rewritten — platform-specific CSS)
- `frontend/src/components/Layout.jsx` (new)
- `frontend/src/components/RequireAuth.jsx` (new)
- `frontend/src/pages/LoginPage.jsx` (new)
- `frontend/src/pages/RegisterPage.jsx` (new)
- `frontend/src/pages/DashboardPage.jsx` (new)
- `frontend/src/pages/ApplicationPage.jsx` (new)
- `frontend/.env.local` (new)
