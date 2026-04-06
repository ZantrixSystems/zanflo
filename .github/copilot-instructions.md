# Copilot Instructions - Multi-Tenant SaaS Licensing Platform

You are working on a multi-tenant SaaS licensing platform for councils and similar public-sector organisations.

---

## What This Platform Does

- Public users submit licence applications online
- Staff review, process, and decide on applications
- Staff can request additional information from applicants
- Applications move through a fixed set of workflow states
- Decisions are recorded with a full audit trail
- Applicants receive email notifications at key points
- Multiple tenant organisations (councils) operate independently on one platform

---

## Multi-Tenancy — Non-Negotiable

The system is multi-tenant from day one. This must never be deferred or retrofitted.

- `tenant_id` is required on every tenant-scoped table
- Tenant isolation is enforced at the backend query level
- No tenant can read or write another tenant's data
- Platform-level concerns and tenant-level concerns are separate
- Early MVP may be built using one internal test tenant — acceptable
- Schema and access control must support multiple tenants from the first migration

---

## Roles

**Platform level:**
- `platform_admin` — manages tenants and platform config

**Tenant level:**
- `tenant_admin` — manages users and settings within a council
- `officer` — reviews and processes applications
- `manager` — supervisory; can reassign and view all tenant cases
- `applicant` — public user who submits and tracks applications

Platform roles and tenant roles are separate. A user may hold both.

---

## Application Lifecycle (Fixed — Do Not Build a Workflow Engine)

```
draft -> submitted -> under_review -> awaiting_information -> under_review
                                   -> approved
                                   -> refused
```

Decision types: `approve`, `refuse`, `request_information`

---

## Roadmap Discipline

The project follows a phase-led delivery model.
See `docs/roadmap/00_PLATFORM_HIGH_LEVEL_ROADMAP.md`.

- Always identify the current phase before starting work
- Align all work to the current phase
- Do not skip phases silently — phase skipping must be explicit and justified
- Flag missing design decisions rather than making silent assumptions
- Raise gaps — do not paper over them

Phases:
- Phase 0 — Orientation
- Phase 1 — MVP Service Design
- Phase 2 — Domain Data Design
- Phase 3 — System Architecture
- Phase 4 — Delivery Planning
- Phase 5 — MVP Build
- Phase 6 — MVP Stabilisation
- Phase 7 — Post-MVP Evolution

---

## Key Principles

- Modular monolith — do NOT split into microservices
- All validation and auth enforced server-side — never trust the frontend
- No sensitive data in browser storage
- Role checks in the backend handler — not the frontend
- Audit every mutation (actor, timestamp, action, affected record)
- Never store documents in the relational database — metadata only, files in object storage

---

## Schema Rules

Every main table must include: `id`, `created_at`, `updated_at`

Tenant-scoped tables must also include: `tenant_id`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React (Vite) |
| Backend | Cloudflare Workers |
| Database | Neon (Postgres) |
| Storage | Object storage (S3-compatible) |
| Email | Transactional email service (e.g. Resend) |

---

## Coding Expectations

- Keep backend logic explicit and readable
- Enforce tenant isolation in every query — no exceptions
- Never expose data across tenant boundaries
- Validate all inputs server-side before any database write
- Prefer simple and correct over clever

---

## When Unsure

- Choose the simplest maintainable option
- Ask before making breaking changes
- Do not skip phases or make silent assumptions
