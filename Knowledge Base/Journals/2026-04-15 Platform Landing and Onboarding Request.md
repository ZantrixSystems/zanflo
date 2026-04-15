# 2026-04-15 Platform Landing and Onboarding Request

**Confidence Level: High**
**Phase: 5.5 - Tenant Foundation (controlled extension)**
**Scope: Root platform landing page + controlled onboarding request intake**

---

## Why this work fits the current phase

This change stays inside the existing Phase 5.5 direction:

- `zanflo.com` is now treated as the platform apex
- tenant portals remain tenant-specific
- onboarding is still controlled and manual

This is not self-service tenant provisioning.
It is a request intake path only.

---

## What was implemented

### Frontend

The root host now has a dedicated platform landing page using the existing Alabaster Terminal theme:

- hero
- what it is
- key benefits
- how it works
- request access form
- existing user guidance

The apex site no longer behaves like an applicant login portal.

The frontend is now host-aware:

- `zanflo.com` -> platform landing page
- `platform.zanflo.com` -> internal platform admin placeholder shell
- other hosts -> existing tenant portal routes

### Backend

Added a public platform endpoint:

- `POST /api/platform/request-access`

This stores a new row in `tenant_onboarding_requests` with:

- organisation name
- contact name
- work email
- requested subdomain
- optional message
- status = `pending`

The request is recorded as a platform-level action and audited.

---

## Validation applied

The request form validates:

- work email present and not from obvious personal mailbox domains
- requested subdomain format
- reserved subdomain protection
- clash with existing tenant slug/subdomain
- clash with another pending request for the same subdomain

Reserved hostnames remain protected and do not resolve as tenant portals.

---

## URL strategy now expressed in the product

- `zanflo.com` is the platform landing and onboarding entry point
- `platform.zanflo.com` is reserved for internal platform administration
- `<tenant>.zanflo.com` remains the tenant-facing portal for applicants and tenant staff

This makes the public root domain semantically correct and avoids mixing applicant portal behaviour into the platform apex.

---

## Design doctrine followed

The landing page reuses the active Alabaster Terminal system:

- existing CSS tokens from `frontend/src/index.css`
- existing page width and spacing rhythm
- existing form, button, card, and section patterns
- Manrope typography and uppercase tracked section labels
- warm alabaster, gold, and tonal-surface layering

No UI library was added.
No parallel colour system or generic SaaS treatment was introduced.

---

## Deferred items

Still intentionally deferred:

- automatic tenant provisioning
- DNS automation
- approval workflow for onboarding requests
- platform admin frontend beyond hostname reservation shell
- email notifications for request receipt / review outcome
