# Tenant Bootstrap And Admin Onboarding

## Purpose

Define the intended MVP behaviour for tenant onboarding, break-glass admin issuance, and entry-point separation.

## Rules

- Tenant onboarding is manual in MVP and performed by a `platform_admin`
- Self-service tenant signup is not part of the active MVP runtime path
- The apex host `zanflo.com` is a product site, not an admin signup or tenant bootstrap flow
- The platform host `platform.zanflo.com` is reserved for platform administration only
- Each tenant uses `<tenant>.zanflo.com` for its public applicant portal
- Tenant staff and tenant admins use `<tenant>.zanflo.com/admin`
- The first tenant admin account is a break-glass account issued during manual onboarding
- The break-glass account uses local username/email plus password auth even if SSO is enabled later
- Platform roles and tenant roles remain separate concerns
- Additional tenant staff access uses tenant-scoped memberships and tenant roles only
- Role assignments must use existing tenant roles only: `tenant_admin`, `manager`, `officer`
- `platform_admin` remains a separate platform-scoped concern

## Tenant Status Model

- `pending_setup` means the tenant exists in the platform but is not available to the public tenant portal
- `active` means the tenant public portal and tenant staff entry are available
- `suspended` means tenant-facing access is blocked while platform administration remains available
- `disabled` means the tenant is inactive and tenant-facing access is blocked

## Access Model

- Applicants start from the tenant public homepage and use `/apply` as the single public start route
- Applicant registration and sign-in remain tenant-scoped
- Tenant staff sign in through `/api/staff/login` and must belong to the tenant resolved from the host
- Platform admins sign in through `/api/platform/login`
- Mixed `/api/auth/*` runtime paths are not part of the active MVP route model

## SSO Direction

- SSO is a later capability, not a prerequisite for issuing the first tenant admin account
- Future SSO mapping must bind users to tenant-scoped roles
- The break-glass local admin path must remain available even after SSO is added
