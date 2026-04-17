# Platform High Level Roadmap

Multi-tenant SaaS licensing platform for councils and public-sector organisations.

---

## Global Rules

These rules apply to all phases and all work on this platform.

- All work must align to the current roadmap phase
- Phase skipping must be a conscious, explicit decision — not accidental drift
- Gaps in design or decisions must be raised and resolved, not silently ignored
- The system is multi-tenant from day one — schema, access control, and architecture must always reflect this
- Early MVP build may use one initial internal tenant for testing, but multi-tenancy must never be retrofitted
- Journals must record decisions and rationale for all meaningful changes

---

## Phase 0 — Orientation

**Goal:** Confirm what we are building, for whom, and under what constraints — before any design or build work begins.

**This phase is complete when:** scope, actors, workflow, and multi-tenant approach are agreed and documented.

Activities:
- Confirm the licensing scope (what type of licences, what jurisdictions, what rules)
- Confirm actor types (applicant, officer, manager, tenant admin, platform admin)
- Confirm MVP boundaries (what is in and what is explicitly out)
- Gather real workflow examples from a target council if possible
- Confirm multi-tenant approach (one platform, many councils, full tenant isolation)
- Define platform roles vs tenant roles clearly
- Confirm identity direction (own auth, external provider, or hybrid)
- Confirm early build approach (one internal test tenant is acceptable for MVP)

Outputs:
- Service definition document
- Workflow diagrams (even rough ones)
- Assumptions and constraints list
- Repo structure, instruction files, and Knowledge Base in place

Note: It is acceptable to build early vertical slices once the flow is clear, even if some design detail is still being confirmed. Do not wait for perfection before starting.

---

## Phase 1 — MVP Service Design

**Goal:** Define the full MVP service model — what each actor does, what the system does for them, and what the workflow looks like end to end.

**This phase is complete when:** all journeys are mapped, lifecycle is confirmed, and the service boundary is agreed.

### Actor Journeys

**Applicant:**
- Creates a draft application
- Completes required fields and uploads documents
- Submits the application
- Receives email confirmation on submission
- Receives email when information is requested
- Responds with additional information
- Receives email when a decision is made
- Can view their application status

**Officer (staff reviewer):**
- Views incoming applications for their tenant
- Takes ownership of a case (or is assigned)
- Reviews application content and documents
- Requests additional information from the applicant
- Records a decision (approve or refuse)
- Can reassign a case to another officer

**Manager (staff supervisor):**
- Views all cases within their tenant
- Can reassign cases
- Has visibility over workflow bottlenecks
- May have authority to override decisions (to be confirmed per tenant)

**Tenant Admin:**
- Manages users within their council
- Configures tenant-level settings
- Does not process applications directly

**Platform Admin:**
- Onboards and manages tenant organisations
- Manages platform-level configuration
- Does not process tenant applications

### Application Lifecycle

```
draft -> submitted -> under_review -> awaiting_information -> under_review
                                   -> approved
                                   -> refused
```

States:
- `draft` — started by applicant, not yet submitted
- `submitted` — submitted by applicant, awaiting staff pickup
- `under_review` — assigned to an officer, being actively reviewed
- `awaiting_information` — officer has requested more information from applicant
- `approved` — final positive decision recorded
- `refused` — final negative decision recorded

Decision types:
- `approve` — moves application to approved state
- `refuse` — moves application to refused state
- `request_information` — moves application to awaiting_information state

### Ownership and Reassignment

- Each application has an assigned officer (owner)
- Cases can be reassigned by the assigned officer or a manager
- Unassigned applications sit in a shared queue
- Assignment must be audited

### Notifications

Email notifications are sent to the applicant at:
- Submission confirmed
- Information requested
- Decision made (approved or refused)

Internal notifications (in-app or email) for staff are out of scope for MVP unless confirmed otherwise.

Outputs:
- Journey maps for each actor
- Confirmed lifecycle diagram
- Notification specification
- Scope boundary document (in vs out of MVP)

---

## Phase 2 — Domain Data Design

**Goal:** Produce a stable, production-safe schema before writing application code.

**This phase is complete when:** all core tables are designed, reviewed, and migration files are written.

### Core Domain Entities

| Entity | Notes |
|--------|-------|
| tenants | One row per council / organisation |
| users | Platform-level user accounts |
| memberships | Links users to tenants with a tenant role |
| platform_roles | Roles at platform level (e.g. platform_admin) |
| tenant_roles | Roles within a tenant (e.g. officer, manager, tenant_admin) |
| applicants | Public users who submit applications (may or may not have accounts) |
| applications | Core case record — scoped to tenant |
| documents | Metadata only — files stored in object storage |
| decisions | Decision records linked to applications |
| licences | Issued licence records (post-approval) |
| payments | Payment records if payment is required (may be Phase 7) |
| audit_logs | Immutable log of all mutations |

### Schema Rules

- `tenant_id` is required on all tenant-scoped tables
- Platform-level tables (tenants, users, platform_roles) are not tenant-scoped
- Memberships bridge the platform user to a tenant with a role
- Documents must not be stored in the relational database — metadata only
- Audit logs must be append-only and cover all mutations
- Every main table must include: `id`, `created_at`, `updated_at`
- Tenant-scoped tables must also include: `tenant_id`

### Multi-Tenancy Rule

The schema must be multi-tenant from day one. Tenant isolation is enforced at the query level in the backend. No tenant should ever be able to read or write another tenant's data.

Outputs:
- Entity relationship diagram
- Schema definition per table
- Migration files (numbered, sequential)
- Storage strategy confirmed

---

## Phase 3 — System Architecture

**Goal:** Lock down system structure, API contract, and auth model before building.

**This phase is complete when:** all major technical decisions are made and documented.

### Structure

- **Modular monolith** — all backend logic in one deployable unit, organised by module
- Frontend and backend are separately deployed
- Backend handles all business logic, auth, and data access
- No microservices

### Components

| Component | Responsibility |
|-----------|---------------|
| Frontend (React/Vite) | Applicant portal and staff dashboard |
| Backend API (Cloudflare Workers) | Routing, auth, business logic, data access |
| Relational DB (Neon/Postgres) | Primary data store |
| Object storage | Document and file storage |
| Email service | Transactional email (e.g. Resend) |
| Identity | Session/cookie auth or external provider (to confirm) |

### Environment Model

At minimum:
- `development` — local
- `staging` — pre-production, safe to test with
- `production` — live

### Auth and Access Control

- Sessions are server-issued (not client-managed)
- No sensitive data in browser storage
- Role checks are enforced in the backend handler — never rely on frontend-only guards
- Platform roles and tenant roles are separate — a user may have both
- Tenant isolation is enforced at the query level for every data access

### API Design

- REST or RPC-style, to be confirmed
- All responses include appropriate HTTP status codes
- No tenant data leakage across API responses
- API shape must be documented before build

Outputs:
- Architecture decision records (in journals)
- Component diagram
- Auth and session model
- API contract shape
- Environment model

---

## Phase 4 — Delivery Planning

**Goal:** Break the build into clear, sequenced modules with defined acceptance criteria.

**This phase is complete when:** the build sequence is agreed and acceptance criteria exist for MVP scope.

### Module Sequence (indicative)

1. Auth and identity foundation
2. Tenant and user management (platform level)
3. Membership and tenant role assignment
4. Application submission (public applicant flow)
5. Application review queue (staff)
6. Case assignment and ownership
7. Information request flow
8. Decision recording
9. Licence issuance
10. Email notifications
11. Audit log visibility

### Testing Approach

- Unit tests for business logic functions
- Integration tests for API handlers (against real DB where possible)
- End-to-end tests for critical journeys (submission, decision)
- No mocking the database for integration tests

### Deployment Approach

- Deployment via CI/CD pipeline
- Migrations run before worker deployment
- Rollback plan defined before any destructive migration

### Support Assumptions

- MVP will be operated by a small internal team
- No self-service tenant onboarding at MVP — platform admin onboards tenants manually
- Runbook exists before any real tenant is onboarded
- Demo exception: a self-service tenant onboarding vertical slice may be enabled when it is explicitly documented in journals and doctrine
- This exception does not silently replace the core MVP operating model; it is a deliberate pull-forward for demonstration and validation only

Outputs:
- Ordered backlog
- Acceptance criteria per module
- Testing strategy
- Deployment pipeline plan

---

## Phase 5 — MVP Build

**Goal:** Implement the core platform to the agreed MVP scope.

**Delivery principle:** vertical slice delivery — each slice delivers real, working, tested functionality end to end.

### Build Order

Build in this sequence. Do not skip ahead.

1. **Auth and tenant foundation** — sessions, login, platform roles, tenant scoping
2. **Tenant and user management** — create tenants, create users, assign memberships and roles
3. **Application submission** — applicant can create, complete, and submit an application
4. **Application review** — officer can view, claim, and review applications
5. **Information requests** — officer can request information; applicant can respond
6. **Decisions** — officer can record approve or refuse; decision is stored and audited
7. **Notifications** — email sent to applicant on submission, information request, and decision
8. **Audit log** — all mutations logged with actor, timestamp, action, and affected record
9. **Document handling** — upload to object storage, metadata in DB, linked to application

### Rules During Build

- Auth and tenant scoping must be working before any application data is written
- Every handler must enforce tenant isolation — no exceptions
- Audit log writes must accompany every mutation from the start
- Do not defer security to a later pass

---

## Phase 6 — MVP Stabilisation

**Goal:** Harden the system before any real tenants are onboarded.

**This phase is complete when:** the system is safe, observable, and operationally understood.

Activities:
- Security review — auth flows, permission boundaries, tenant isolation, input validation
- Performance review — query plans, missing indexes, unnecessary scans
- Structured error handling — consistent error responses, no stack traces to clients
- Logging and observability — request logging, error logging, alerting basics
- Input validation — all inputs validated server-side before any DB write
- Admin tooling — platform admin can view tenants, users, and system health
- End-to-end testing of all critical journeys
- Operational runbook — how to deploy, rollback, monitor, and support

---

## Phase 7 — Post-MVP Evolution

**Goal:** Extend the platform after the core is stable and proven with real users.

**Nothing in this phase is committed until Phase 6 is complete.**

Candidates:
- Additional licence types and tenant-configurable fields
- Payments integration
- Reporting and data export
- Applicant account portal (view history, reapply)
- Configurable workflow steps (explicitly deferred from MVP)
- SMS notifications
- Bulk operations for staff
- Multi-council onboarding self-service tooling
- API integrations with council back-office systems

---

*Detailed sprint planning and decisions live in Knowledge Base/Journals. This roadmap is intentionally high level and phase-led.*
