Confidence Level: High

## Summary

Added a tenant-host fallback in the static frontend shell so deleted or unknown tenant subdomains do not present a blank page.

## Reason

- the wildcard tenant host still served the SPA shell even when the tenant row no longer existed
- a Worker-level HTML fallback was not taking effect on the live asset route
- the user still saw a blank page on a deleted tenant host, which is poor demo and support behaviour

## What changed

- updated `frontend/index.html`
- removed an accidental leading `1` character before the doctype
- added a static tenant availability check in the HTML shell for tenant hosts
- the shell now calls `/api/tenant/public-config`
- when that request fails, the shell shows a plain `Tenant not found` message with a link back to `zanflo.com`

## Scope

- frontend shell fallback only
- no change to workflow, auth model, or tenant ownership rules

## Verification

- `npm --prefix frontend run build`
- `npm run deploy`

## Truthfulness note

- the live wildcard host may still serve the SPA shell itself first
- this change makes the user-visible behaviour safe and understandable even in that hosting mode

---

## Route Repair Follow-up

Fixed a tenant-host frontend startup fault that could still leave valid council routes looking blank even when the API was healthy.

### Findings

- live checks showed `riverside1.zanflo.com` API routes were working:
  - `/api/tenant/public-config` returned tenant data
  - `/api/staff/bootstrap-exchange` accepted the bootstrap token
- the remaining problem was in the React startup path on tenant hosts, not in tenant resolution or bootstrap token handling
- `frontend/src/App.jsx` called hooks after conditional early returns, which is unsafe in React and can break rendering when the auth loading state changes between renders
- the shell fallback script in `frontend/index.html` was also querying DOM nodes from the `<head>` before the body existed, which made the fallback behaviour less reliable

### Changes

- moved tenant availability and shell visibility effects so hook order is stable in `frontend/src/App.jsx`
- removed the unconditional `requestAnimationFrame` fallback hide from `frontend/src/main.jsx`
- changed the shell fallback bootstrap script in `frontend/index.html` to run on `DOMContentLoaded`
- kept the tenant-not-found and bootstrap fallback behaviour in place

### Verification

- `npm --prefix frontend run build`
- `npm test`

### Risk note

- this fixes the concrete tenant-host startup fault we found
- if any further browser-only runtime issue appears, it should now present a visible shell state instead of a blank page, which is safer for demo and support
