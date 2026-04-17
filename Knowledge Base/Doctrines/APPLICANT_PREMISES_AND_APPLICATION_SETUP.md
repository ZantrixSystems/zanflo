# Applicant Premises And Application Setup

## Purpose

Define the intended MVP behaviour for reusable applicant-owned premises and the first tenant-owned application setup surface.

## Rules

- `premises` is a first-class tenant-scoped entity from this slice onward
- A premises belongs to one `applicant_account` within one tenant only
- Premises are never cross-tenant and are never shared across applicant accounts
- New applications must be created against an existing owned premises
- The fixed workflow remains in code:
  - `draft`
  - `submitted`
  - `under_review`
  - `awaiting_information`
  - `approved`
  - `refused`
- This slice does not introduce configurable workflow
- This slice does not introduce a generic form builder

## Traceability Model

- `applications.premises_id` links an application to the reusable premises record
- `applications.premises_name`
- `applications.premises_address`
- `applications.premises_postcode`
- `applications.premises_description`

These fields remain on `applications` as the case snapshot used for legal traceability and staff review.

Rationale:

- staff casework must remain readable even if the premises record changes later
- historic applications must not depend on live mutable premises data alone
- this is the safest MVP path without introducing a broader submission snapshot engine yet

## Applicant Journey

- Applicant creates a tenant-scoped account
- Applicant creates one or more premises records
- Applicant starts a new application from a selected premises
- Applicant can edit their premises record later
- When a premises record is updated, editable linked applications may have their premises snapshot refreshed
- Submitted and decided applications keep their recorded application snapshot

## Staff Journey

- Staff continue to work from tenant-scoped application queues and application detail pages
- Staff visibility remains application-led, not premises-led
- Staff can see the linked premises record context on an application, but access remains through the tenant-scoped application route

## Tenant Admin Journey

- Tenant admins own tenant-level application setup
- The current MVP-safe setup surface is bounded to:
  - enabled application types visibility
  - applicant-facing intro and guidance copy
  - metadata for known hardcoded fields only
- Metadata groundwork may include:
  - `field_key`
  - `label override`
  - `help_text`
  - `enabled`
  - `required`
  - `sensitive`

## Explicit Non-Goals In This Slice

- configurable workflow engine
- arbitrary tenant-defined fields
- a fully schema-driven form renderer
- cross-tenant applicant identity
- tenant-admin casework permissions
