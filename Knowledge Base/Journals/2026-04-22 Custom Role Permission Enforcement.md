# 2026-04-22 Custom Role Permission Enforcement

**Phase:** 5 — MVP Build  
**Confidence Level:** High  
**Scope:** Backend permission enforcement wired end-to-end

---

## Summary

Connected the custom roles and permissions system to the backend guards. Custom role permissions are now enforced on all relevant API routes. Staff members can be assigned a custom role from the Users page, which overrides their permission set. `tenant_admin` retains unconditional full access.

---

## Changes

### Migration
- `migrations/0028_memberships_custom_role.sql` — adds `custom_role_id UUID REFERENCES custom_roles(id) ON DELETE SET NULL` to `memberships`. Partial index on non-null values.

### `src/lib/guards.js`
- Added `requireTenantStaffWithPermissions(request, env, ...roles)` — like `requireTenantStaff` but additionally loads `custom_role_permissions` from DB when the session has a `custom_role_id`, and attaches them as `session.permissions`.
- Added `hasPermission(session, permission)` — returns `true` if session role is `tenant_admin` (always full access), or if `session.permissions` includes the key.
- `requireTenantStaff` is unchanged — still used where no permission check is needed.

### `src/routes/admin-audit.js`
- Uses `requireTenantStaffWithPermissions` (allows manager, officer, tenant_admin)
- Gate: `audit.view`

### `src/routes/admin-settings.js`
- Uses `requireTenantStaffWithPermissions` (allows manager, officer, tenant_admin)
- Gate on GET: `settings.view`
- Gate on PUT: `settings.edit`

### `src/routes/admin-users.js`
- Uses `requireTenantStaffWithPermissions`
- Gate on all handlers: `users.manage`
- `listUsers` now returns `custom_role_id`, `custom_role_name`, and `custom_roles` list
- `updateUser` accepts `custom_role_id` in body — validates it belongs to the tenant, then updates separately

### `src/routes/admin-premise-cases.js`
- Uses `requireTenantStaffWithPermissions` on all handlers
- Gate on `listCases`, `getCaseStats`, `getCase`: `cases.view`
- Gate on `assignCase`: `cases.assign`
- Gate on `requestInformation`, `verifyCase`, `recordDecision`: `cases.decide`

### `src/routes/staff-auth.js`
- `/api/staff/me` now looks up `custom_role_id` from `memberships` and loads the permission set
- Returns `{ session: { ...session, custom_role_id, permissions } }`

### `frontend/src/pages/AdminUsersPage.jsx`
- Edit user modal now shows a custom role dropdown (if custom roles exist for the tenant)
- Hint text warns that tenant_admin ignores custom role permissions
- User row shows custom role name inline: `officer · Senior Officer`
- Hint link to `/admin/settings/roles` when no custom roles exist

---

## Architectural decisions

**`tenant_admin` is always exempt from permission checks.**  
`hasPermission` short-circuits to `true` for `tenant_admin`. This avoids the scenario where a misconfigured custom role locks a tenant admin out.

**Custom roles override, not supplement, built-in non-admin permissions.**  
If a `manager` is assigned a custom role with only `cases.view`, they can only view — not assign or decide. The custom role is the effective permission set. This is intentional: it enables fine-grained downscoping of built-in roles.

**DB lookup only when `custom_role_id` is set.**  
`requireTenantStaffWithPermissions` only hits the DB if the membership has a custom role. No extra query for the majority of requests from `tenant_admin` users.

**Two separate UPDATE statements for role and custom_role_id.**  
Avoided an inline conditional SQL expression which is fragile with the neon template tag. Two clean, unconditional updates are equivalent and explicit.

---

## What remains deferred

- Enforcing `cases.view` / `cases.assign` / `cases.decide` in legacy `admin-applications.js` and `admin-cases.js` routes (these are deprecated but still wired)
- Frontend permission-aware UI hiding (e.g. hide "Assign" button if user lacks `cases.assign`) — currently the backend rejects but the button still shows
- Custom role assignment during user creation (only available on edit for now)
