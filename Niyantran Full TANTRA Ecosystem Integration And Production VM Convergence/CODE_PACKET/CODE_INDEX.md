# CODE_INDEX.md
### Niyantran — TANTRA Ecosystem Integration — Modified Files Index

Every file changed or created for the TANTRA ecosystem integration, with explanation.

---

## New Files

| File | Purpose |
|------|---------|
| `server/services/bucketClient.js` | Niyantran's HTTP client for bhiv-bucket. Builds ArtifactEnvelopes, validates admission via governance gate, writes artifacts. Convenience wrappers: `storeScreenshot()`, `storeExport()`, `storeKarmaEventRecord()`, `checkHealth()`. |
| `server/services/karmaClient.js` | Niyantran's KARMA signal producer. Validates against `karma_signal_contract.json v1.0.0`, routes through `bucketClient` (never calls KARMA directly). Signal factories: `signalExcessiveIdle()`, `signalDisallowedSite()`, `signalKeystrokeAnomaly()`, `signalNormalActivity()`, `signalLateCheckin()`. |
| `server/routes/integrationHealth.js` | `GET /api/integration/health` — admin-only endpoint that probes Bucket, PRANA, and reports KARMA routing status. Never throws. |
| `server/tests/bucketClient.test.js` | 24 tests: envelope builder, governance validation, artifact writes, health check, missing env graceful degradation. |
| `server/tests/karmaClient.test.js` | 38 tests: contract validation (all 7 fields), Bucket routing, all 5 signal factories, invariant checks (`product_context: "workflow"`, `requires_core_ack: true`). |
| `server/tests/tantraHealth.test.js` | 18 tests: TANTRA health, execution participation (happy/governance-denied/blocked/failed paths), history with tenant isolation, rejection logging. |
| `server/tests/integrationHealth.test.js` | 13 tests: Bucket healthy/unreachable, PRANA healthy/unreachable/not_configured, KARMA routing, env flags, architecture notes, timestamp format, never-crash guarantee. |

---

## Modified Files

### `server/services/activityTracker.js`
**Change:** Added `karmaClient.signalExcessiveIdle()` call at line ~222 inside the idle detection block.
**Why:** When an employee exceeds the idle threshold, Niyantran now emits a KARMA behavioral event (via Bucket) in addition to the existing `MonitoringAlert`. Fire-and-forget.

### `server/services/websiteMonitor.js`
**Change:** Added `karmaClient.signalDisallowedSite()` call at line ~754 inside the disallowed website handler.
**Why:** When a disallowed site is detected, Niyantran now emits a KARMA RESTRICT signal (severity 0.8) alongside the existing alert and screenshot capture. Fire-and-forget.

### `server/services/ems_signals.js`
**Change:** Added `karmaClient.signalExcessiveIdle()` call at line ~311 inside the idle time signal emission.
**Why:** The EMS signal layer's idle detection now also emits KARMA signals, complementing the activityTracker path. Fire-and-forget.

### `server/services/screenCapture.js`
**Change:** Added `bucketClient.storeScreenshot()` call at line ~177 after `screenCapture.save()`.
**Why:** Screenshots are now additively stored in Bucket alongside Cloudinary (primary). Bucket write is fire-and-forget — Cloudinary remains the source of truth.

### `server/services/bucketClient.js`
**Change:** Updated phase label comment from "Phase 4" to corrected ordering note explaining Bucket must be active before KARMA signals work (B7 authorization constraint).

### `server/index.js`
**Change:** Added `app.use('/api/integration', require('./routes/integrationHealth'))` at line ~516.
**Why:** Registers the integration health check route alongside TANTRA execution.

### `server/middleware/auth.js`
**Change:** Removed hardcoded `"jwtSecret"` fallback. Server now aborts if `JWT_SECRET` is not set.
**Why:** Security hardening — a hardcoded fallback secret in production is a pre-existing risk flagged during this integration work.

### `server/middleware/executionAuth.js`
**Change:** Added startup check — server aborts if `TANTRA_EXECUTION_KEY` is not set.
**Why:** Prevents accidental deployment without the execution key.

### `server/.env`
**Change:** Added `TANTRA_EXECUTION_KEY`, `BUCKET_BASE_URL`, `BUCKET_API_KEY`, `BUCKET_TIMEOUT_MS`, `PRANA_BASE_URL`, `PRANA_API_KEY`.

### `server/.env.example`
**Change:** Added documented sections for TANTRA, Bucket, and PRANA env vars with generation instructions.

### `docker-compose.yml`
**Change:** Added `redis`, `bhiv-bucket`, `bhiv-prana`, `karma-tracker` services. Backend now depends on `bhiv-bucket`. Added `BUCKET_BASE_URL`/`PRANA_BASE_URL` environment overrides.

### `docker-compose.production.template.yml`
**Change:** Same as dev compose but using `IMG_TAG` image references, no public ports on ecosystem services, and `redis_data` volume.

### `server/routes/tantraExecution.js`
**Change:** Pre-existing TANTRA runtime route — execution participation, health, history with tenant isolation.

### `server/package.json`
**Change:** Added `jest` and `supertest` devDependencies. Jest config: `testMatch: **/tests/**/*.test.js`.
