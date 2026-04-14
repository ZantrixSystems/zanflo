# 2026-04-14 Project Rename — ZanFlow → ZanFlo

**Confidence Level:** High

---

## Decision

The product name changes from **ZanFlow** to **ZanFlo**.
The platform domain changes from the previously assumed `zanflow.co.uk` to **`zanflo.com`**.

**Reason:** Brand refinement at early stage. Easier to do this now than carry the wrong name forward into further development, documentation, and infrastructure.

---

## What Was Renamed (Automatically, In This Session)

| Location | Change |
|----------|--------|
| `wrangler.toml` — `name` | `zanflow` → `zanflo` |
| `package.json` — `name` | `zanflow` → `zanflo` |
| `package-lock.json` — `name` | regenerated as `zanflo` |
| `src/lib/tenant-resolver.js` — `PLATFORM_DOMAIN` | `zanflow.co.uk` → `zanflo.com` |
| `src/lib/tenant-resolver.js` — all comments | updated |
| `frontend/index.html` — `<title>` | `Zanflow` → `ZanFlo` |
| `frontend/src/components/Layout.jsx` — brand text | `Zanflow` → `ZanFlo` |
| `frontend/src/index.css` — file comment | `Zanflow` → `ZanFlo` |
| `Knowledge Base/Doctrines/DESIGN_SYSTEM.md` | `Zanflow` → `ZanFlo` |
| `Knowledge Base/Journals/2026-04-14 Phase 5.5 Tenant Foundation.md` | `zanflow.co.uk` → `zanflo.com` (forward-looking references only) |
| `migrations/0009_...sql` — comment only | `zanflow.co.uk` → `zanflo.com` |

---

## What Was Left Unchanged and Why

| Location | Reason |
|----------|--------|
| `Knowledge Base/Journals/2026-04-14 Hosted Dev Deployment.md` | Historical record of past deployment events — URLs shown are what actually existed at that time. Changing them would falsify the record. |
| `Knowledge Base/Journals/2026-04-08 First Vertical Slice Schema and API.md` | Same — historical truth |
| All migration filenames | Filenames are immutable historical identifiers — renaming them would break the migration tracking system |
| Database tenant row values (`slug = 'riverside'`, etc.) | These are data values, not app names — no rename needed |
| Git repository path (`c:/git/zanflow/zanflow`) | Local filesystem path — no impact on the running system. Can be reorganised separately if desired. |

---

## Infrastructure Changes Required (Manual — Not Done In Code)

### 1. Cloudflare Worker rename

Changing `name = "zanflow"` to `name = "zanflo"` in `wrangler.toml` means that the **next `npm run deploy` will create a new Worker** named `zanflo` on Cloudflare.

**Effect:**
- New workers.dev URL: `zanflo.zantrixsystems.workers.dev`
- Old URL (`zanflow.zantrixsystems.workers.dev`) will continue to serve the old Worker until you delete it

**Actions required after deploy:**
1. Run `npm run deploy` — this will provision the new `zanflo` Worker
2. Verify the new URL: `https://zanflo.zantrixsystems.workers.dev`
3. Re-set secrets on the new Worker (the old Worker's secrets do not transfer):
   ```bash
   npx wrangler secret put DATABASE_URL --name zanflo
   npx wrangler secret put JWT_SECRET --name zanflo
   ```
4. Verify the app is working at the new URL
5. Delete the old `zanflow` Worker via Cloudflare dashboard or:
   ```bash
   npx wrangler delete zanflow
   ```

### 2. Neon project / database name

The Neon project may be named `zanflow` in the Neon dashboard. **This is cosmetic only** — it does not affect `DATABASE_URL` or connectivity. The connection string uses the Neon endpoint ID, not the project name.

**Recommendation:** Rename the Neon project in the Neon dashboard to `zanflo` for consistency. This requires no code change and carries zero risk to connectivity.

### 3. GitHub repository

The repo is currently at `ZantrixSystems/zanflow`. To rename it:
1. Go to GitHub → Settings → General → Repository name
2. Change to `zanflo`
3. Update your local remote: `git remote set-url origin https://github.com/ZantrixSystems/zanflo.git`

This is optional but recommended for consistency.

### 4. Local filesystem path

Currently: `c:/git/zanflow/zanflow/`

This can be left as-is with no impact on the running system. If you want to reorganise:
1. Close any open terminals and editors pointing at the old path
2. Move/rename the directory
3. Update any IDE workspace settings

---

## Domain Status

`zanflo.com` is the confirmed platform domain.

DNS wildcard (`*.zanflo.com → Cloudflare Worker`) is **not yet configured** — this is deferred until the domain is registered and the Worker is production-ready.

The fallback (`X-Tenant-Slug` header) remains active in `tenant-resolver.js` until the wildcard DNS is in place.

---

## Post-Deploy Verification Checklist

After running `npm run deploy` and setting secrets:

- [ ] `https://zanflo.zantrixsystems.workers.dev` loads the app
- [ ] Login works (staff session)
- [ ] Applicant registration works
- [ ] Application creation works
- [ ] Tenant resolution works (X-Tenant-Slug: riverside still resolves correctly)
- [ ] Old `zanflow.zantrixsystems.workers.dev` URL — confirm it still works during transition, then delete old Worker
