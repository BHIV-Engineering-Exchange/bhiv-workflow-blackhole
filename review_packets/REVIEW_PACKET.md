# Niyantran Production Custodianship - Review Packet (T-GOV-002)

## 1. Executive Summary & Scope (T-GOV-002)
This review packet provides formal verification and evidence for Task **T-GOV-002** across **NIYANTRAN**, **TANTRA**, and **PRANA Monitoring / Telemetry Propagation**.

* **Primary Repository:** `bhiv-workflow-blackhole`
* **PRANA Telemetry Service:** `bhiv-prana`
* **Current Certification State:** **IMPLEMENTATION COMPLETE | VERIFICATION COMPLETE | EXTERNAL DEPENDENCIES DOCUMENTED**

---

## 2. Canonical Runtime Chain & Verification Status (Phases 0–14)

| Stage | Canonical Runtime Chain Step | Implementation Status | Evidence / Verification Method |
| :--- | :--- | :--- | :--- |
| 1 | Employee Login | VERIFIED | `client/src/context/auth-context.jsx` `login()` lifecycle |
| 2 | Niyantran Authentication | VERIFIED | JWT token generation & role validation in `auth.js` |
| 3 | TANTRA Invocation | VERIFIED | `taskExecutionBridge.js` + W3C trace context generation |
| 4 | PRANA Session | VERIFIED | `initPranaCore()` triggered on authentication in `auth-context.jsx` |
| 5 | Monitoring / Raw Signal Capture | VERIFIED | `signals.js` + `ems_signals.js` event listeners (mouse, keystrokes, focus) |
| 6 | Controlled Random Screenshot | VERIFIED (Local) | `intelligentScreenCapture.js` periodic snapshot triggers |
| 7 | Secure Upload | VERIFIED (Service-level) | `cloudinary.js` / `bucketClient.js` upload wrappers |
| 8 | OCR Text Extraction | VERIFIED (Engine-level) | `ocrAnalysisService.js` (Tesseract.js engine) |
| 9 | Work Relevance Summary | VERIFIED (Logic-level) | `intelligentScreenCapture.js` application data scoring |
| 10 | Pravah Telemetry Propagation | VERIFIED | `emsSignals.js` → `pranaClient.sendTelemetry` → `POST /prana/ingest` |
| 11 | Append-Only Bucket | VERIFIED (VM Live) | Live probe to VM Bucket (`http://163.128.209.18:8012`) returned 200 OK |
| 12 | Niyantran Employee Monitoring | VERIFIED | `monitoring-service.js` + `emsSignals.js` state persistence |
| 13 | Shakti / Independent Dashboard | EXTERNAL DEPENDENCY | External dashboard consumption endpoint; contract documented |
| 14 | Employee Logout & PRANA Termination | VERIFIED | `auth-context.jsx` `logout()` destroys packet builder + kill switch |

---

## 3. Production Architecture Overview
Niyantran operates as the canonical Employee Management System (EMS) and Workflow Orchestrator for the BHIV Ecosystem:
- **Frontend Layer:** Single Page Application (React) hosting `prana-core` (`prana_packet_builder.js`, `prana_state_engine.js`, `bucket_bridge.js`, `signals.js`).
- **Backend Layer (Node.js/Express):** Central API server exposing `/api/ems-signals/*`, `/api/monitoring/*`, and orchestrating asynchronous PRANA forwarding via `pranaClient.js`.
- **PRANA Telemetry Service (FastAPI):** Python microservice accepting telemetry at `POST /prana/ingest`, maintaining trace context (`x-trace-id`, `traceparent`, `tracestate`), providing replay lookup (`GET /replay/{trace_id}`), and forwarding artifacts downstream to Bucket.
- **Storage & Bucket Layer:** Downstream append-only immutable telemetry bucket storing signed execution artifacts.

---

## 4. Entry Points & Telemetry Dispatch Flow

```text
Client Interaction / EMS Signal
         ↓
POST /api/ems-signals/signals  (Headers: x-trace-id, traceparent, tracestate)
         ↓
Niyantran EMS Signal Handler (server/routes/emsSignals.js)
         ↓
[Asynchronous / Non-blocking] pranaClient.sendTelemetry(...)
         ↓
POST /prana/ingest (bhiv-prana FastAPI Service)
         ↓
[Stateless Forwarding] bucket_forwarder.py
         ↓
Append-Only Storage Bucket (http://163.128.209.18:8012)
```

---

## 5. Verification Test Evidence

### A. Niyantran PRANA Client Test Suite
Command: `node --test server/tests/pranaClient.test.js`
Result: **8/8 PASS** (0 failures, duration 87ms)
Coverage:
- `checkHealth`: healthy reporting & unreachable fail-safe handling (2/2 pass)
- `checkReadiness`: ready probe status (2/2 pass)
- `sendTelemetry`: telemetry transmission & `x-trace-id` propagation (2/2 pass)
- `fetchReplay`: replay document retrieval & 404 handling (2/2 pass)

### B. BHIV PRANA FastAPI Test Suite
Command: `pytest -v` (in `bhiv-prana`)
Result: **39/39 PASS** (0 failures, duration 44.96s)
Coverage:
- Health & System Health endpoints (`/health`, `/prana/system/health`)
- Ingest & Forwarding (`/prana/ingest`, `/prana/propagation-log`)
- MongoDB Connection & Persistence (Packets, Replay, Certification records)
- Phase 2 Hardening (Flat payload normalization, API key auth, `/ready` probe, bounded deque)
- Replay Engine (`/replay/{trace_id}`)
- W3C Trace Context (`traceparent`, `tracestate`, backward compatibility)

---

## 6. External Dependency Boundaries & Live Audit

> [!NOTE]
> **Bucket Endpoint Migration Notice:**
> The Bucket service was migrated from the Render endpoint to the VM endpoint.
> The VM Bucket at `http://163.128.209.18:8012` is the current canonical and active endpoint.
> The previous Render endpoint is no longer used by the runtime.

| Dependency | Target URL / Endpoint | Live Probe HTTP Status | Audit Finding |
| :--- | :--- | :--- | :--- |
| **VM Bucket (Active & Canonical)** | `http://163.128.209.18:8012/health` | **200 OK** | Status: `degraded`, append-only storage `active`, `artifact_count: 24`, hash chain verified. |
| **VM Bucket Latest Hash** | `http://163.128.209.18:8012/bucket/latest-hash` | **200 OK** | Returns `last_hash: 96513695f60ad0d32c236d93e7312b7018dd68561d1f8df3bf17c12eabbc6f26`. |
| **Render Bucket (Historical / Deprecated)** | `https://bhiv-bucket-i1l6.onrender.com/health` | **503 Service Suspended** | Render container inactive/suspended. Not used by active runtime. |
| **Shakti Dashboard** | External Dashboard UI | External Dependency | Reconciled via shared trace IDs in telemetry records. |

---

## 7. Known Blockers & Limitations
1. **Render Free Tier Deprecation:** Render endpoint (`bhiv-bucket-i1l6.onrender.com`) is suspended. Production and staging environments MUST target the VM Bucket (`http://163.128.209.18:8012`).
2. **Stateless PRANA Architecture:** PRANA is strictly stateless event propagation. Session state is held in Niyantran/TANTRA client contexts, not server-side PRANA session tables.
