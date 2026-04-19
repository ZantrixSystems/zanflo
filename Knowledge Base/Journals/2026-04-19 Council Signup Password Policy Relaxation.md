# 2026-04-19 Council Signup Password Policy Relaxation

**Confidence Level: High**
**Phase: 5.5 - Tenant Foundation (explicit extension)**
**Scope: Relax council self-service bootstrap password policy for journey testing**

---

## Why this work fits the current phase

This change stays inside the active Phase 5.5 tenant bootstrap work:

- the council self-service signup journey already exists
- the request was to adjust the bootstrap password rule used in that journey
- no schema, tenant isolation, or role model behaviour changed

---

## What changed

Updated the self-service council signup bootstrap password rule so it now requires:

- at least 8 characters
- at least one uppercase letter
- at least one number

Lowercase letters and symbols are now optional for this specific bootstrap flow.

Updated:

- `src/lib/password-policy.js`
- `frontend/src/pages/ApexCouncilSignupPage.jsx`
- `Knowledge Base/Doctrines/TENANT_BOOTSTRAP_AND_ADMIN_ONBOARDING.md`
- signup integration tests that exercise the apex council bootstrap path

---

## Verification

Passed:

- `npx vitest run tests/integration/slice11-platform-onboarding.test.js`

Additional note:

- `npx vitest run tests/integration/slice1-auth-foundation.test.js` still shows pre-existing test cleanup failures caused by incomplete fixture teardown for newer tenant-related tables. These failures are separate from the password policy change.
