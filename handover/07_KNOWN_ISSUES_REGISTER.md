# Known Issues Register — Niyantran (workflow-blackhole)

Every item below was independently reproduced or confirmed by reading the actual source — nothing here is copied from the prior `HANDOVER.md`/`REVIEW_PACKET.md` without re-verification, and several items below were not documented anywhere before this handover. Ordered by severity, most severe first.

---

## 🔴 Critical

### 1. User passwords are stored and compared in plain text
**Where:** `server/routes/auth.js` (`register`, `login`, `verify-password`), `server/models/User.js`, `server/routes/admin.js`.
**Verified:** `login` does `if (password !== user.password)` — a raw string comparison against the stored field. `User.js`'s only `pre("save")` hook updates `updatedAt`; there is no hashing hook. `admin.js` contains the comment `// Handle password update (without bcrypt)` directly above a plaintext password write, confirming this was a deliberate choice rather than an oversight in one spot. `bcryptjs` is a declared dependency but is not invoked anywhere in the live code paths (confirmed by `grep -r bcrypt` across the whole non-`node_modules` codebase — only 2 hits, one a comment, one a one-off script `create_test_user.js`).
**Impact:** anyone with read access to the MongoDB database (production Atlas cluster) can read every user's real password directly, with no cracking required. Given the SMTP/email integration and typical password-reuse patterns, this is a severe organizational risk, not just an application-level one.
**Recommendation:** hash on write (`bcrypt.hash` in a `pre("save")` hook, or explicitly in the register/reset handlers) and compare with `bcrypt.compare` on read. Because existing passwords are already plaintext, a migration is needed: either force a password reset for all users on deploy, or hash existing plaintext values in place as a one-time migration script before switching the comparison logic over. This should be prioritized above anything else in this register.

---

## 🟠 High

### 2. `TANTRA_EXECUTION_KEY` is required to boot but is undocumented in `.env.example`
**Verified:** `index.js` hard-fails startup (`process.exit(1)`) if `TANTRA_EXECUTION_KEY` is unset — confirmed by actually running the server with no `.env`. The key does not appear anywhere in `.env.example` (confirmed by grepping the file's declared keys). A brand-new setup following `.env.example` verbatim will fail to start with an error message that (helpfully) names the missing variable, but only after the engineer has already gone looking for why.
**Recommendation:** add `TANTRA_EXECUTION_KEY` (with the generation command already printed by the app itself: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) to `.env.example`.

### 3. `.env.example` documents 20 variables; the code actually reads ~65
**Verified:** cross-referenced every `process.env.X` reference in `server/` against `.env.example`'s declared keys. 45 variables — including `PORT`, `REDIS_URL`, `BUCKET_API_KEY`/`BUCKET_BASE_URL`, `PRANA_API_KEY`/`PRANA_BASE_URL`, all 5 `SAMPADA_SETU_*` vars, `SETU_AUTHORITY`, `SETU_GOVERNANCE_SIGNATURE`, office/geofence config (`OFFICE_LAT`, `OFFICE_LNG`, `OFFICE_RADIUS`, etc.), and EMS tuning knobs — are read by the code but absent from the example file. Full list in `02_ARCHITECTURE_GUIDE.md` §8.
**Recommendation:** regenerate `.env.example` from an actual `grep -roh "process\.env\.[A-Z_]*"` pass (the same technique used to build this register) so it's complete and stays complete going forward.

### 4. Pre-shipped `node_modules` contains a platform-mismatched native binary
**Verified:** running `node index.js` against the repo's shipped `server/node_modules` failed with `Error: .../canvas.node: invalid ELF header` — the `canvas` package's compiled binary was built for a different OS/architecture than the one it was run on. After `rm -rf node_modules && npm install` (fresh install, 779 packages), the same boot succeeded past that point cleanly.
**Impact:** if `node_modules` is copied (via zip, rsync, or committed to git) between machines with different OS/CPU architecture instead of freshly installed on the target, the server will fail to boot with a confusing low-level error that doesn't obviously point at "reinstall your dependencies."
**Recommendation:** ensure `node_modules` is git-ignored (standard practice) and that deployment always runs `npm install`/`npm ci` fresh on the target platform — never copies a pre-built `node_modules` across machines.

### 5. `Procfile`-equivalent risk does not apply here, but the analogous issue exists in `ai-crm` — see that repo's register. Not applicable to this repo; listed here only to note it was checked.

---

## 🟡 Medium

### 6. 22 of 60 route files are dead code, never mounted
**Verified:** cross-referenced every file in `server/routes/` against every `require()` in the entire codebase (not just `index.js`) — these 22 files are not loaded by anything: `activity.js` and `agent.js` (both empty, 0 bytes), `aiAgents.js` (a helper module, not a router — imported by `aiRoutes.js`, so not itself "dead" but also not an endpoint), `aiReview.js`, `aiRoutePy.js`, `aim.js`, `aimsWithProgress.js`, `aims_unified.js`, `attendanceDataManagement.js`, `attendance_fixed.js`, `attendance_fixed_final.js`, `attendance_no_default_aims.js`, `attendance_upload_fixed.js`, `biometricAttendanceFixed.js`, `compliance.js`, `executionVisibility.js`, `liveAttendance.js`, `new.js`, `salaryManagement.js`, `salaryRoutes.js`, `testProgress.js`, `testSync.js`.
**Impact:** navigability — file names like `attendance_fixed_final.js` strongly suggest "this is the current version," but the actually-active file is `attendance.js`. A future engineer could easily edit the wrong file and wonder why nothing changes.
**Recommendation:** delete or move to an `archive/` folder outside `routes/`. Full status table in `03_SOURCE_CODE_WALKTHROUGH.md` §2.

### 7. `routes/biometricAttendanceFixed.js` has an actual JavaScript syntax error
**Verified:** `node --check routes/biometricAttendanceFixed.js` fails with `SyntaxError: Unexpected token 'debugger'` — the file declares `const debugger = new AttendanceDebugger();`, and `debugger` is a reserved word in JavaScript. Confirmed harmless today only because the file is never `require()`-d (see item 6).
**Recommendation:** fix (rename the variable) or delete along with the rest of the orphaned attendance route variants.

### 8. `WorkSession.js` and `WorkSessionUpdated.js` are byte-identical duplicate models
**Verified:** `diff` shows zero difference between the two files; both register the Mongoose model name `WorkSession`. Only `WorkSession.js` is actually imported anywhere (4 call sites). Because only one is ever loaded in a given process, there's no `OverwriteModelError` risk today, but it's dead, confusing duplication.
**Recommendation:** delete `WorkSessionUpdated.js`.

### 9. `Tenant.js` model file is completely empty
**Verified:** 0 bytes. Meanwhile `middleware/tenantIsolation.js` exists and has its own passing test suite (`tenantIsolation.test.js`).
**Recommendation:** confirm with the team whether tenant isolation is intentionally schema-less (tenant ID as a plain field on other documents) or whether this file is an unfinished model that was meant to formalize a `Tenant` collection.

### 10. Duplicate MongoDB index on `WebsiteWhitelist.approval_status`
**Verified:** the field declares `index: true` inline *and* the schema separately calls `.index({ approval_status: 1 })`. Confirmed by reading both lines. Reproduced live — Mongoose logs `Warning: Duplicate schema index on {"approval_status":1} found` on every server boot (see `13_EVIDENCE_PACKET.md`).
**Recommendation:** one-line fix — remove either the inline `index: true` or the explicit `.index()` call.

### 11. `docker-compose.yml` (dev) references two Dockerfiles that don't exist in this repo
**Verified:** `bhiv-bucket/Dockerfile` and `bhiv_prana/Dockerfile` are referenced as build contexts but neither file exists anywhere in the repository (direct file check). `docker compose up` will fail specifically on those two services; the other five (Mongo, Redis, Karma, backend, frontend) build fine. The production compose template correctly avoids this by using an externally-hosted Bucket service instead, so this is a **dev-environment-only** gap.
**Recommendation:** either source the missing Dockerfiles from whoever owns Bucket/PRANA, or comment those two services out of the dev compose file with a note pointing at the external Bucket for anyone who needs full local integration testing.

### 12. Local backup script does not cover the production database
**Verified:** `backup automation/backup-db.ps1` runs `mongodump` against the local Docker container `niyantran_database`. Production's real `.env` `MONGODB_URI` points at MongoDB Atlas, not this local container.
**Recommendation:** confirm Atlas's own backup/point-in-time-recovery settings with whoever administers that cluster; this repo's backup automation should not be assumed to protect the production data.

### 13. `ai.js`, `newSalaryManagement.js`, and other route files carry large commented-out blocks of superseded code alongside the live implementation
**Verified:** e.g. `routes/auth.js` opens with ~250 lines of commented-out email-template code before the real router starts at line 267; `routes/ai.js` has an entire commented-out duplicate of its 3 live routes directly above the active versions. Not a functional bug (confirmed the extraction tooling correctly ignores these), but it roughly doubles the reading effort for anyone new to these files.
**Recommendation:** low priority, but a cleanup pass removing dead commented code would meaningfully improve future onboarding speed.

---

## 🟢 Low / cosmetic

### 14. Inconsistent env var naming: `MONGODB_URI` vs `MONGO_URI`, `EMAIL_PASSWORD` vs `EMAIL_PASS`
Both pairs are read by different parts of the code (verified via grep). Not currently broken because the actual `.env` sets both members of each pair to the same value, but it's a foot-gun for anyone updating credentials who only updates one variant.

### 15. Frontend production bundle is a single ~987 KB JS chunk (261 KB gzipped)
Verified via `npm run build` output. Functional — the app works — but Vite's own build warning flags this as a candidate for route-based code-splitting to improve initial load time.

### 16. `Monitoring/prometheus.yml` and `Monitoring/datasource.yml` are wired into production but not into the dev compose file
**Correction to an earlier draft of this register:** these configs are **not** dead/unconnected — `docker-compose.production.template.yml` runs full `prometheus`, `grafana`, `node-exporter`, and `cadvisor` containers wired to them (ports 9090 and 3000 respectively). The gap is narrower than first thought: **`docker-compose.yml` (dev)** has no equivalent monitoring stack, so a local developer won't see metrics unless they stand up the production compose file instead. Not a defect, just worth knowing which compose file to reach for if you need to see metrics locally.

### 17. Production deploy pipeline uses password-based SSH with host-key checking disabled
**Verified:** `.github/workflows/cicd.yml`'s deploy job uses `sshpass -p "${{ secrets.VM_PASSWORD }}" ssh ... -o StrictHostKeyChecking=no`. This is a working, functional pattern (and the password is stored as a GitHub secret, not hardcoded), but it's weaker than SSH key-based auth with a pinned host key, which is the more common hardened practice for CI/CD deployment. Not urgent, but worth a conscious decision by whoever owns the VM/pipeline security rather than leaving as an oversight.

### 18. The production reverse proxy and VM are shared across multiple BHIV products, not dedicated to Niyantran
**Verified:** `proxy configurations/nginx.ssl.conf` contains `server_name` blocks for `niyantran.blackholeinfiverse.com` as well as `gurukul.blackholeinfiverse.com`, `gurukuldrishiti.blackholeinfiverse.com`, `samruddhi.blackholeinfiverse.com`, `parikshak.blackholeinfiverse.com`, and `sampada.blackholeinfiverse.com`, each proxying to different ports on the same host (`163.128.209.18` appears directly in several of the non-Niyantran blocks). Not a defect, but it means changes to this file can affect other products' routing, and the underlying VM's resource usage/downtime affects more than just Niyantran. Coordinate with whoever owns the shared VM before making proxy-level changes.

### 19. Hardcoded JWT fallback secret still present in `routes/auth.js` — contradicts a claim in the pre-existing `REVIEW_PACKET.md`
**Verified:** the pre-existing `REVIEW_PACKET.md` (dated 2026-07-25, in the repo root) claims under "Changed Services → Security": *"JWT_SECRET hardcoded fallback removed."* Directly reading `routes/auth.js`, this is not accurate — **five separate live call sites** still contain `process.env.JWT_SECRET || "jwtSecret"` (register, login, verify-password, verify-reset-token, reset-password; two more instances exist but are inside commented-out dead code and don't count). Confirmed by grep, excluding comments.
**Why it matters despite the startup guard:** `index.js` does refuse to boot if `JWT_SECRET` is unset (verified elsewhere in this package), which contains the practical risk today. But the fallback string `"jwtSecret"` is a **publicly-readable, hardcoded, guessable value now committed to this repo's history** — if the startup guard is ever refactored, bypassed, or these functions are reused in a context that doesn't go through `index.js`'s check (e.g. a script, a test, a different entrypoint), tokens would silently be signed/verified with a well-known secret instead of failing loudly.
**Recommendation:** remove the `|| "jwtSecret"` fallback from all five call sites so a missing `JWT_SECRET` fails the operation instead of silently using a weak default — this is a low-effort, high-value fix, and should be done alongside the password-hashing fix in item 1 since both are in the same file. Also worth a note to whoever maintains `REVIEW_PACKET.md` that this specific claim needs correcting or the fix needs finishing, since the two are currently out of sync — see `12_REVIEW_PACKET.md` for how this handover package reconciles it.


---

## Not a bug — worth knowing anyway

- **Redis is optional by design.** `services/eventBus.js` automatically falls back to an in-process `EventEmitter` if Redis is unreachable — confirmed by reading the fallback logic. This is good, deliberate resilience engineering, not a gap.
- **The `/api/dashboard` and `/api/attendance` prefixes are each served by two different route files** (`dashboard.js` + `dashboardFixed.js`; `attendance.js` + `attendanceStatus.js`). This is intentional layering (confirmed by the inline comments in `index.js` — e.g. "Enhanced dashboard APIs" and "Electron agent polling endpoint"), not a conflict, since the two files in each pair don't define overlapping sub-paths. Just worth knowing so it doesn't look like a mistake when you see the same prefix mounted twice.
