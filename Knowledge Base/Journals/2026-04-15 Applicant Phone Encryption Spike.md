# 2026-04-15 Applicant Phone Encryption Spike

**Confidence Level: Medium**
**Phase: 5 — MVP Build**
**Scope: Narrow application-layer encryption proof for `applications.applicant_phone` only**

---

## What was implemented

Added a small backend-only encryption spike for one sensitive field:

- Field selected: `applications.applicant_phone`
- Encryption boundary: server-side only in the Cloudflare Worker
- KMS provider: Google Cloud KMS
- Storage target: Neon/Postgres

The route handlers do not perform encryption logic directly.
Instead they call a dedicated encryption module:

- `src/lib/google-kms.js` — Google OAuth + KMS REST calls
- `src/lib/field-encryption.js` — field-specific encryption/decryption policy

This keeps the route layer readable and leaves a clean seam for a later move to envelope encryption.

---

## Why this field was chosen

`applications.applicant_phone` is a good first spike field because:

- it is sensitive personal data
- it is not part of authentication
- it is not a high-value lookup field today
- it sits on the application flow, not the identity/auth path

This makes the blast radius lower than encrypting `applicant_accounts.phone` first.

---

## Schema change

Migration added:

- `applicant_phone_kms_key_name`
- `applicant_phone_kms_key_version`
- `applicant_phone_encryption_scheme`

The existing `applications.applicant_phone` column is retained and is now used to store ciphertext for new encrypted writes.

The marker value for this spike is:

- `gcp_kms_direct_v1`

Rows without this marker are treated as legacy/plaintext compatibility rows.
That preserves existing dev data and avoids a destructive bulk rewrite during the spike.

---

## Runtime behaviour

### On write

When an applicant saves `applicant_phone` on an application draft:

1. the Worker builds field-specific AAD using `tenant_id` + `application_id`
2. the Worker calls Google KMS `cryptoKeys.encrypt`
3. ciphertext is stored in `applications.applicant_phone`
4. the configured KMS key name and returned CryptoKeyVersion name are stored alongside it

No raw key material is stored in Neon.
No encryption or decryption is done in the frontend.

### On read

When an application is returned from the API:

1. the Worker checks `applicant_phone_encryption_scheme`
2. if the marker is `gcp_kms_direct_v1`, the Worker calls Google KMS `decrypt`
3. plaintext phone is returned in the API response
4. KMS metadata columns are stripped from the response body

If the row has no encryption marker, the backend treats it as a legacy row and returns the value unchanged.

---

## What this protects

This spike protects against:

- casual plaintext exposure in Neon for newly encrypted `applications.applicant_phone` values
- accidental direct reading of that field from the database without backend decryption
- treating field encryption as a frontend concern

This does not protect against:

- compromise of the application runtime that can call KMS
- privileged misuse by code already running with KMS access
- every other sensitive field in the platform
- full database storage encryption at rest

This is explicitly **application-layer encryption**, not Google CMEK for Neon and not full database-at-rest encryption.

---

## Risks and limitations

- This uses direct KMS encrypt/decrypt calls, so latency is higher than a local envelope-encryption design.
- Existing plaintext dev rows are not bulk-backfilled by this change.
- Service account private key handling now matters operationally and must stay server-side only.
- Decrypting on every read will not scale well if used broadly.

---

## Proper production evolution

If the platform adopts field encryption more widely, the next design should be:

- generate a per-record or per-field data encryption key (DEK)
- encrypt field data locally in the Worker
- wrap the DEK with Google KMS
- store ciphertext + wrapped DEK + metadata in Postgres

That would reduce KMS round-trips, scale better, and provide a cleaner long-term key hierarchy.

This spike was intentionally kept smaller than that.

---

## Important boundary statement

This work does **not** mean:

- Neon is CMEK-backed by Google KMS
- the whole database is encrypted by customer-managed keys from Google
- the platform now has final-form encryption architecture

It means only this:

- one selected application field can now be encrypted server-side before storage using Google Cloud KMS as the root encryption service
