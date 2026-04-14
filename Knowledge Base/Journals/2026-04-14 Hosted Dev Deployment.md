# 2026-04-14 — Hosted Dev Deployment

**Confidence Level: High**
**Phase: 5 — MVP Build**
**Goal: Move from localhost-only testing to live hosted dev/staging environment**

---

## URLs

| Component | URL |
|-----------|-----|
| Backend (Cloudflare Worker) | https://zanflow.zantrixsystems.workers.dev |
| Frontend (Cloudflare Pages) | https://zanflow.pages.dev |

---

## What was done

### Backend changes

**CORS — removed hardcoded localhost origins**

`src/index.js` previously had `ALLOWED_ORIGINS` hardcoded as a const array with only localhost values.
Replaced with an `ALLOWED_ORIGINS` environment variable (Cloudflare secret), parsed at runtime.

Why env var, not wrangler.toml `[vars]`:
- `[vars]` are committed to source control and visible to anyone who reads the file.
- ALLOWED_ORIGINS includes prod URLs which should be controlled carefully.
- Secrets allow updates without redeployment and without source exposure.

**Cookie SameSite — fixed for cross-origin deployment**

`SameSite=Lax` blocks cookies on cross-origin requests in modern browsers.
When frontend (*.pages.dev) and backend (*.workers.dev) are on different origins,
the browser will not send a `SameSite=Lax` cookie — the session silently breaks.

Fix:
- When request is HTTPS (`isSecure = true`): set `SameSite=None; Secure`
- When request is HTTP (`isSecure = false`): keep `SameSite=Lax` (SameSite=None requires Secure and is rejected on HTTP)

This logic is applied to both `session` (staff) and `applicant_session` (public) cookies.
Both `buildCookie` / `clearCookie` and `buildApplicantCookie` / `clearApplicantCookie` were updated.
Logout functions updated to accept `request` so they can detect HTTPS context.

**Security note:** `SameSite=None` weakens CSRF protection for this pair of origins. This is acceptable for a dev/staging environment and is a known, explicit choice. Before production, co-locating frontend and backend under the same domain (e.g. custom domain + Worker route) would restore `SameSite=Strict` or `SameSite=Lax`. This is logged as a pre-production risk.

### Secrets set on Cloudflare Worker

| Secret | Value | Note |
|--------|-------|------|
| DATABASE_URL | (Neon connection string) | Pre-existing |
| JWT_SECRET | (random 32+ byte string) | Pre-existing |
| ALLOWED_ORIGINS | `https://zanflow.pages.dev,https://7f9c4aa5.zanflow.pages.dev` | Added this session |

### Local dev

Added `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173` to `.dev.vars`.
This means local wrangler dev will accept CORS from the local Vite dev server.

### Frontend changes

**`.env.production`** created and committed:
```
VITE_API_URL=https://zanflow.zantrixsystems.workers.dev
VITE_TENANT_SLUG=riverside
```

This file is safe to commit — it contains no secrets, only public URLs.
`VITE_*` vars are baked into the JS bundle at Vite build time.

**`.env.local`** kept for local dev only (`localhost:8787`). Git-ignored.

**`public/_redirects`** added:
```
/*  /index.html  200
```

Without this, Cloudflare Pages returns 404 on direct navigation to client-side routes
(`/dashboard`, `/applications/:id`, etc.). The `_redirects` file instructs Pages to
serve `index.html` for all paths, letting React Router handle routing client-side.

**`frontend/.env.production`** added to `.gitignore` exclusion comment — intentionally NOT ignored.

### Deployment sequence

1. `npx wrangler deploy` — deployed updated backend with env-based CORS + SameSite=None fix
2. `npm run migrate` — ran migrations 0004–0007 against Neon
3. `npm run seed` — created Riverside Council tenant, enabled app types, seeded staff users
4. Built frontend: `npm run build` — baked production API URL into bundle
5. `npx wrangler pages deploy dist --project-name zanflow` — deployed to Pages

---

## Migrations run

| Migration | Status |
|-----------|--------|
| 0001–0003 | Already applied (skipped) |
| 0004 applicant_accounts | Applied |
| 0005 application_types + tenant_enabled | Applied |
| 0006 audit_logs | Applied |
| 0007 applications update | Applied |

---

## Seed actions run

- Tenant: Riverside Council (slug: `riverside`)
- Application types enabled: `premises_licence`, `provisional_statement`
- Platform admin: `admin@platform.internal`
- Officer: `officer@riverside.gov.uk` with membership to Riverside

---

## Verification (all passed)

Tested against `https://zanflow.zantrixsystems.workers.dev` with Origin `https://zanflow.pages.dev`:

1. Unauthenticated `/me` → 401 ✓
2. Register new applicant account → 201, session cookie set ✓
3. `/me` with cookie → returns session payload ✓
4. `/application-types` → returns premises_licence, provisional_statement ✓
5. Create application → draft created ✓
6. Save draft fields → status remains draft ✓
7. List applications (resume path) → application visible ✓
8. Submit → status becomes submitted ✓
9. Logout → cookie cleared ✓
10. `/me` after logout → 401 ✓

---

## How tenant resolution works

1. Every API request from the frontend carries `X-Tenant-Slug: riverside` (set in `api.js` from `VITE_TENANT_SLUG` env var).
2. At `/applicant/register` and `/applicant/login`, the backend resolves the slug to a `tenant_id` from the DB.
3. `tenant_id` is encoded into the `applicant_session` JWT cookie.
4. All subsequent requests read `tenant_id` from the session JWT — the header is not trusted again post-auth.
5. Every DB query includes `AND tenant_id = ${session.tenant_id}` — enforced at query level.
6. Applications are further scoped to `applicant_account_id` — an applicant cannot access another applicant's data.

---

## Risks identified

| Risk | Severity | Notes |
|------|----------|-------|
| `SameSite=None` on deployed cookies | Medium | Reduces CSRF protection. Acceptable for dev/staging. Fix before production by co-locating frontend/backend under a shared domain. |
| No rate limiting on auth endpoints | Medium | Register and login are unthrottled. Needs fixing before real public exposure. |
| No email verification on register | Medium | Any email address can be used. Required before real public use. |
| No password reset flow | Medium | Users who forget passwords are locked out. Required before real public use. |
| `applicant_account_id` nullable in DB | Low | Enforced at application layer. Should be hardened with DB NOT NULL before real tenant onboarding. |
| ALLOWED_ORIGINS includes preview deploy hash | Low | `7f9c4aa5.zanflow.pages.dev` is a specific deployment hash URL. Each new deployment gets a new hash. Either maintain the list or switch to wildcard via custom domain later. |

---

## What should be built next

Following the Phase 5 build order from the roadmap:

**Next: Staff review slice**
- Officer login (existing `/auth/login` + session already works)
- Staff view of submitted applications for their tenant
- Case assignment (officer takes ownership)
- Basic case detail view

This requires:
- A staff-facing frontend (separate from the public applicant portal, or a protected route within it)
- `GET /staff/applications` — list submitted/under_review applications for the tenant
- `POST /applications/:id/assign` — assign to self or another officer
- Status transition: `submitted → under_review`

The backend auth is already in place. The staff session JWT already carries `tenant_id` and `role`.
What's missing is the staff route handlers and the staff UI.

---

## Custom domain attempt â€” `zanflo.com`

### What was changed in runtime config

Added this to `wrangler.toml`:

```toml
[[routes]]
pattern = "zanflo.com"
custom_domain = true
```

This keeps Wrangler as the source of truth for Worker domain binding.

### Deployment result

Ran:

```bash
npx wrangler deploy
```

Result:
- Worker upload succeeded
- Custom domain attach failed with Cloudflare API error `100117`

Error meaning:
- `zanflo.com` already has existing DNS records at the apex
- Cloudflare refused to replace them automatically during this deploy

### Runtime verification

Observed at time of check:
- `Resolve-DnsName zanflo.com -Type A` returned `104.21.36.251` and `172.67.201.158`
- `https://zanflo.com` returned `200 OK`
- Response headers indicate an existing GoDaddy-hosted site is currently live on the apex domain
- `https://www.zanflo.com` returned `301` redirect to `https://zanflo.com/`

### Decision

Do **not** force `override_existing_dns_record` without an explicit cut-over decision.

Reason:
- Overriding the existing DNS record would replace the current apex site with the Cloudflare Worker
- This is a live production-affecting change, not a harmless config sync

### Current status

- Repo config is ready for `zanflo.com`
- Worker code is deployed successfully
- Custom domain is **not** attached yet because the existing apex DNS has not been deliberately replaced

### Remaining action when ready

When the apex site is ready to be replaced:
1. Remove or replace the current apex DNS target in Cloudflare
2. Re-run `npx wrangler deploy`
3. Verify `https://zanflo.com`
4. Then decide whether to add `www.zanflo.com` as a second custom domain or keep the current redirect behaviour

### Follow-up attempt after explicit cut-over approval

The cut-over was then explicitly approved and retried the same day.

Additional actions taken:
- Re-ran `npx wrangler deploy`
- Tried non-interactive deploy path
- Created the Worker custom-domain changeset directly via Cloudflare API

Result:
- Custom domain object for `zanflo.com` now exists against Worker `zanflo`
- Final `domains/records` bind still failed with `100117`

Important finding:
- The local Cloudflare auth can manage Workers and create the custom-domain object
- It does **not** appear able to manage the conflicting apex DNS records for the zone from this environment
- Direct DNS record API calls returned authentication errors, which suggests missing DNS edit capability on the current token/session

So the cut-over is now blocked on Cloudflare-side DNS authority, not repo config.

### Operational status at end of session

- `wrangler.toml` is correct for `zanflo.com`
- Worker `zanflo` is deployed
- Custom domain registration has been initiated on the Worker
- Apex DNS is still serving the pre-existing site until the conflicting DNS record is removed or replaced by a session with DNS edit access
