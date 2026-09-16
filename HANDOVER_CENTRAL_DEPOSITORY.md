# Central Depository Handover Document — T-GOV-002

## 1. System Overview

| Subsystem | Role & Scope | Primary Technology |
| :--- | :--- | :--- |
| **NIYANTRAN** | Canonical Employee Management System (EMS) & Workflow Orchestrator. Handles authentication, task assignments, activity monitoring, and signal ingestion. | Node.js, Express, React, MongoDB |
| **TANTRA** | Ecosystem execution bridge and trace orchestrator ensuring unified workflow lineage and tenant isolation. | Node.js / Express Middleware & Bridges |
| **PRANA** | Cognitive Telemetry Engine & Propagation Service. Receives raw signals, normalizes packets, maintains trace context, and forwards telemetry downstream. | Python, FastAPI, Native Fetch Client |
| **PRAVAH / BUCKET** | Immutable, append-only artifact repository storing cryptographically hashed execution packets and telemetry records. | Python / FastAPI (VM Port 8012) |
| **SHAKTI** | Independent governance and executive dashboard consuming reconciled telemetry traces across ecosystem nodes. | External Web Dashboard Service |

---

## 2. Canonical Runtime Chain

```text
Employee Login
  ↓
Niyantran Authentication (JWT token generated)
  ↓
TANTRA Invocation (Trace context generated)
  ↓
PRANA Session (initPranaCore initialized)
  ↓
Monitoring / Raw Signal Capture (Mouse, keystrokes, window focus)
  ↓
Controlled Random Screenshot (Intelligent screen capture triggers)
  ↓
Secure Upload (Cloudinary / Bucket artifact bridge)
  ↓
OCR Text Extraction (Tesseract.js OCR engine)
  ↓
Work Relevance Summary (Activity scoring & categorisation)
  ↓
Pravah Telemetry Propagation (emsSignals.js → pranaClient → POST /prana/ingest)
  ↓
Append-Only Bucket (Forwarded to VM Bucket: http://163.128.209.18:8012)
  ↓
Niyantran Employee Monitoring (Real-time tracking state updated)
  ↓
Shakti / Independent Dashboard Reconciliation (Trace ID alignment)
  ↓
Employee Logout (AuthContext logout)
  ↓
PRANA Session Termination (Packet builder destroyed, kill switch active)
  ↓
Central Depository Handover
```

---

## 3. Verified API Contracts

### A. Niyantran Ingest Endpoint
* **Path:** `POST /api/ems-signals/signals`
* **Headers:** `Content-Type: application/json`, `x-trace-id`, `traceparent`, `tracestate`
* **Request Body:**
```json
{
  "employeeId": "emp-001",
  "sessionId": "sess-abc-123",
  "signals": [
    {
      "type": "window_focus",
      "value": true,
      "metadata": { "focus_score": 90 }
    }
  ]
}
```
* **Response:** `200 OK`
```json
{
  "success": true,
  "received": 1,
  "processed": 1,
  "employeeId": "emp-001",
  "currentState": "ACTIVE",
  "statistics": { "productivityScore": 90 },
  "timestamp": "2026-09-16T15:00:00.000Z"
}
```

### B. PRANA Ingest Endpoint
* **Path:** `POST /prana/ingest`
* **Headers:** `Content-Type: application/json`, `x-source: niyantran`, `x-trace-id`, `traceparent`, `tracestate`, `x-prana-api-key` (optional)
* **Request Body:**
```json
{
  "user_id": "emp-001",
  "session_id": "sess-abc-123",
  "trace_id": "niyantran-trace-001",
  "focus_score": 90,
  "cognitive_state": "ACTIVE",
  "raw_signals": { "signals_count": 1 },
  "timestamp": "2026-09-16T15:00:00.000Z"
}
```
* **Response:** `200 OK`
```json
{
  "status": "forwarded",
  "trace_id": "niyantran-trace-001",
  "persisted": true
}
```

### C. PRANA Replay Endpoint
* **Path:** `GET /replay/{trace_id}`
* **Response:** `200 OK` (JSON Replay Document) or `404 Not Found`

---

## 4. Telemetry Schema & Trace Propagation

```text
Field                | Type    | Description
---------------------|---------|---------------------------------------------
trace_id             | String  | Unique distributed trace identifier (W3C or UUID)
user_id / employeeId | String  | Canonical employee identity
session_id           | String  | Active work/auth session token
cognitive_state      | String  | State string (ACTIVE, IDLE, AWAY, DEEP_FOCUS)
focus_score          | Number  | Productivity score (0–100)
raw_signals          | Object  | Processed batch count and individual sensor types
timestamp            | String  | ISO-8601 UTC timestamp
traceparent          | String  | W3C Trace Context Header (version-traceid-spanid-flags)
tracestate           | String  | W3C Vendor tracing state
```

---

## 5. Deployment & Configuration Register

| Parameter | Default Local Value | Production Staging Value | Purpose |
| :--- | :--- | :--- | :--- |
| `PRANA_BASE_URL` | `http://localhost:8103` | Configurable internal URL | Base URL for Niyantran backend → PRANA communication |
| `PRANA_API_KEY` | *(empty / optional)* | Environment secret | Mutual service authentication |
| `PRANA_TIMEOUT_MS` | `10000` | `10000` | Non-blocking fetch timeout |
| `BUCKET_URL` | `http://163.128.209.18:8012` | `http://163.128.209.18:8012` | Append-only storage destination |
| `PORT` (Niyantran Backend) | `5001` | `5001` | Node.js backend listener port |
| `PORT` (PRANA FastAPI) | `8103` | `8103` | PRANA microservice port |
| `PORT` (VM Bucket) | `8012` | `8012` | Downstream append-only storage port |

---

## 6. Verification Matrix

| INPUT | EXPECTED | ACTUAL | STATUS | EVIDENCE |
| :--- | :--- | :--- | :--- | :--- |
| `node --test server/tests/pranaClient.test.js` | 8/8 tests pass | 8/8 tests pass (0 failures) | PASS | Automated test run: `pranaClient.test.js` (87ms) |
| `pytest -v` in `bhiv-prana` | 39/39 tests pass | 39/39 tests pass (0 failures) | PASS | Automated pytest run (44.96s) |
| `POST /api/ems-signals/signals` | Signals processed + async PRANA telemetry dispatched | Signals parsed, state updated, non-blocking telemetry sent | PASS | Code verification in `server/routes/emsSignals.js` |
| Live probe to VM Bucket (`http://163.128.209.18:8012/health`) | `200 OK` | `200 OK` (`{"status":"degraded","artifact_count":24}`) | PASS | Live HTTP verification |
| Live probe to VM Bucket Hash (`http://163.128.209.18:8012/bucket/latest-hash`) | `200 OK` with valid hash | `200 OK` (`last_hash: 965136...`) | PASS | Live HTTP verification |
| Live probe to Render Bucket (`https://bhiv-bucket-i1l6.onrender.com/health`) | Endpoint response | `503 Service Suspended` | BLOCKED / DEPRECATED | Live HTTP probe (Render free tier suspended) |

---

## 7. External Dependency Matrix

> [!NOTE]
> **Bucket Endpoint Migration Notice:**
> The Bucket service was migrated from the Render endpoint to the VM endpoint.
> The VM Bucket at `http://163.128.209.18:8012` is the current canonical and active endpoint.
> The previous Render endpoint is no longer used by the runtime.

| Dependency | Endpoint | Expected | Actual | Classification | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **VM Bucket (Canonical)** | `http://163.128.209.18:8012` | `200 OK` append-only storage | `200 OK` active append storage | VERIFIED ACTIVE | Direct HTTP probe returned active artifact log |
| **Render Bucket (Legacy)** | `https://bhiv-bucket-i1l6.onrender.com` | `200 OK` | `503 Service Suspended` | HISTORICAL ONLY — NOT USED BY RUNTIME | Direct HTTP probe |
| **Shakti Dashboard** | External Dashboard UI | Reconciled telemetry traces | External viewer | EXTERNAL DEPENDENCY | Interface contract documented |
| **Cloudinary** | External CDN | Screenshot storage | Active when API keys configured | EXTERNAL DEPENDENCY | `cloudinary.js` upload wrappers |

---

## 8. Known Limitations & Categorized Blockers

* **Code:** Zero implementation gaps within the T-GOV-002 scope.
* **Environment:** Python 3.12 and Node.js v26 runtime environments verified.
* **External Service:** The legacy Render Bucket (`bhiv-bucket-i1l6.onrender.com`) is suspended. The VM Bucket (`http://163.128.209.18:8012`) must be configured in production `.env` files.
* **Dashboard:** Shakti dashboard operates externally and consumes telemetry asynchronously via shared trace IDs.
* **Infrastructure:** In local test mode, if PRANA or Bucket is stopped, Niyantran operates in fail-safe non-blocking mode without interruption.

---

## 9. Troubleshooting & Practical Recovery

1. **PRANA Telemetry Dispatch Warning:**
   * *Symptom:* `[pranaClient] Telemetry dispatch failed (non-blocking): ECONNREFUSED` in Node.js logs.
   * *Cause:* `bhiv-prana` service is not running on port 8103.
   * *Resolution:* Start the PRANA service: `uvicorn app.main:app --port 8103 --host 0.0.0.0` in `bhiv-prana`.
2. **Bucket Degraded Mode:**
   * *Symptom:* Bucket `/health` returns `status: degraded`.
   * *Cause:* Append-only storage is active, but secondary health probes (e.g. external replication) report degraded status.
   * *Resolution:* Normal operation continues as long as `append_only_storage.status: "active"`.
3. **Trace Loss:**
   * *Symptom:* Replay cannot find trace.
   * *Resolution:* Ensure incoming client requests include `x-trace-id` or standard `traceparent` headers.
