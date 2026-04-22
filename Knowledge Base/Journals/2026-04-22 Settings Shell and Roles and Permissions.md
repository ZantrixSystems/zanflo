# 2026-04-22 Settings Shell and Roles & Permissions

**Phase:** 5 — MVP Build  
**Confidence Level:** High

---

## Summary

Introduced a dedicated tenant settings control panel (separate from the case-work UI) and a full custom roles and permissions system. Tenant admins now navigate into a Jira-style settings shell with grouped sidebar navigation, and can create custom roles with granular permission assignments.

---

## Changes

### Migration
- `migrations/0027_custom_roles_and_permissions.sql` — two new tables:
  - `custom_roles (id, tenant_id, name, description, created_at, updated_at)` with `UNIQUE (tenant_id, name)`
  - `custom_role_permissions (role_id, permission_key)` with composite PK — cascade deletes on role drop

### Backend — new route
- `src/routes/admin-roles.js` — full CRUD for custom roles:
  - `GET /api/admin/roles` — list all tenant roles with their permissions
  - `POST /api/admin/roles` — create role
  - `PUT /api/admin/roles/:id` — update role (replaces permission set atomically)
  - `DELETE /api/admin/roles/:id` — delete role
  - Exports `ALL_PERMISSIONS` — the canonical permission registry (`cases.view`, `cases.assign`, `cases.decide`, `users.manage`, `settings.view`, `settings.edit`, `audit.view`)
  - All mutations write to `audit_logs`
  - Permission keys validated against the registry — unknown keys are rejected

### Backend — wired
- `src/index.js` — imported and registered `handleAdminRoleRoutes`

### Frontend — new component
- `frontend/src/components/TenantSettingsLayout.jsx` — settings shell layout:
  - Sticky topbar: back-to-dashboard, org name, sign out
  - Left sidebar with grouped nav (Organisation, Team, Licensing, Platform)
  - Active route highlighted with gold left border
  - Content area with title/description header slot

### Frontend — new pages
- `frontend/src/pages/AdminSettingsGeneralPage.jsx` — Organisation name, support contact, internal admin, bootstrap account info
- `frontend/src/pages/AdminSettingsPublicSitePage.jsx` — Logo, welcome text, homepage text, contact text, public URL preview
- `frontend/src/pages/AdminSettingsSsoPage.jsx` — SAML and OIDC config (unchanged logic, new shell)
- `frontend/src/pages/AdminRolesPage.jsx` — Custom roles control panel:
  - Roles list with permission pill summary
  - Create/edit modal with grouped permission checkboxes (Cases, Team, Settings, Platform)
  - Delete with confirmation
  - Built-in roles reference panel (read-only, informational)

### Frontend — updated
- `frontend/src/pages/AdminSettingsPage.jsx` — now a redirect to `/admin/settings/general`
- `frontend/src/App.jsx` — routes added for `/admin/settings/general`, `/admin/settings/public-site`, `/admin/settings/sso`, `/admin/settings/roles`
- `frontend/src/lib/navigation.js` — "Settings" nav item now links to `/admin/settings/general`; "Licence sections" and "Audit" removed from sidebar (accessible via settings shell)
- `frontend/src/api.js` — added `listAdminRoles`, `createAdminRole`, `updateAdminRole`, `deleteAdminRole`
- `frontend/src/index.css` — added CSS for `.settings-shell`, `.settings-sidebar`, `.settings-nav-*`, `.settings-card`, `.roles-list`, `.role-card`, `.perm-pill`, `.role-permission-*`, `.btn-danger`

---

## Architectural decisions

**Settings shell is a completely separate layout from AdminLayout.**  
No shared nav, no breadcrumbs from the case-work UI. Enters via "Settings" in the sidebar and exits via "Back to dashboard" in the topbar. This mirrors the Jira/Confluence pattern of a distinct settings context.

**Permission set is fixed in code (`ALL_PERMISSIONS` in admin-roles.js).**  
Tenant admins tick which permissions apply to a role. The available permission keys cannot be extended from the UI — adding new gates is a code change. This is intentional for MVP: keeps the model predictable and prevents permission sprawl.

**Custom roles do not replace built-in roles yet.**  
`tenant_admin`, `manager`, and `officer` remain as the active system roles. Custom roles are created and stored but not yet enforced in backend guards. Hook-up to the permission guard layer is deferred to a follow-on journal (Phase 5 backlog item).

**Settings split into three sub-pages: General, Public site, SSO.**  
Each page loads and saves only its own section of `tenant_settings`, fetching the current full settings object before PUT to avoid clobbering sibling sections. A future improvement would be to split the PUT API into section-specific endpoints — noted but deferred.

---

## What is intentionally deferred

- Enforcing custom role permissions in backend guards — roles exist in the DB but are not yet checked in route handlers
- Assigning custom roles to staff members — membership table still uses `tenant_admin | manager | officer` only
- Section-specific settings API endpoints (currently each page does a read-then-write of all sections)
- `audit.view` permission enforcement on `AdminAuditPage`
- Responsive / mobile layout for the settings shell sidebar
