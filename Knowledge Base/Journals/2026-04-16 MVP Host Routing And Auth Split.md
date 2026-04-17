# 2026-04-16 MVP Host Routing And Auth Split

**Confidence Level: High**
**Phase: 5 - MVP Build**
**Scope: Slices 1 to 7 implementation baseline**

---

## What changed

- added an integration test foundation with Vitest and real Postgres-backed helpers
- simplified tenant statuses to:
  - `pending_setup`
  - `active`
  - `suspended`
  - `disabled`
- added explicit backend guards:
  - `requireApplicant`
  - `requireStaff`
  - `requireTenantRole`
  - `requirePlatformAdmin`
- split mixed staff/platform auth into:
  - `POST /api/staff/login`
  - `POST /api/staff/logout`
  - `GET /api/staff/me`
  - `POST /api/platform/login`
  - `POST /api/platform/logout`
  - `GET /api/platform/me`
- removed self-service tenant bootstrap from the active runtime path by unhooking:
  - `POST /api/platform/signup`
  - `/api/platform/bootstrap/*`
- reshaped frontend host routing so:
  - `zanflo.com` is product-only
  - `platform.zanflo.com` uses `/login` and `/dashboard`
  - `<tenant>.zanflo.com` is the tenant public portal
  - `<tenant>.zanflo.com/admin` is the tenant staff/admin entry
- made `GET /api/application-types` public and tenant-scoped
- added `/apply` as the single public application start route

## Explicit correction to earlier 2026-04-16 self-service journal

The earlier self-service bootstrap implementation is no longer the active MVP runtime path.

This was corrected to realign runtime with the roadmap and the agreed access model:

- manual tenant onboarding remains the MVP path
- apex self-service tenant creation is disabled in runtime
- bootstrap activation pages remain historical code only and are not routed live

## Verification

- `npm test`
- `npm --prefix frontend run build`

Both completed successfully after the slice 1 to 7 changes.
