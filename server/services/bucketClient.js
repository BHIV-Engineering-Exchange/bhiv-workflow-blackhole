/**
 * bucketClient.js
 *
 * Niyantran's client for BHIV Bucket (bhiv-bucket FastAPI service).
 *
 * Scope (Bucket integration — additive only, must be active before KARMA signals):
 *   - New artifact writes (screenshots, exports) go through Bucket.
 *   - Existing Cloudinary path (server/utils/cloudinary.js) is NOT touched.
 *   - This client does NOT duplicate Bucket's governance/provenance logic —
 *     it queries Bucket's own governance endpoints and respects the results.
 *   - KARMA's authorization.py only accepts x-source: bucket|core|internal,
 *     so Bucket must be active before any KARMA signal flow works.
 *
 * Architecture constraint (confirmed by code inspection of bhiv-bucket/main.py):
 *   - Bucket expects strict JSON artifacts wrapped in an ArtifactEnvelope.
 *   - The contract write endpoint is POST /bucket/artifacts/write.
 *   - Bucket computes authoritative hashes server-side (client hash ignored).
 *   - Data flow is ONE WAY: external → Bucket only. Bucket does not push back.
 *
 * Auth: x-api-key header if BUCKET_API_KEY is set (optional — Bucket on Render has no key).
 * x-source header identifies Niyantran to downstream services.
 */

"use strict";

const axios = require("axios");
const { randomUUID } = require("crypto");

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET_BASE_URL = process.env.BUCKET_BASE_URL;
const BUCKET_API_KEY = process.env.BUCKET_API_KEY;
const BUCKET_TIMEOUT_MS = parseInt(process.env.BUCKET_TIMEOUT_MS || "5000", 10);

// Integration ID Niyantran registers under with Bucket.
// Must be consistent across all calls from this service.
const NIYANTRAN_INTEGRATION_ID = "niyantran-hr-platform";
const NIYANTRAN_REQUESTER_ID = "niyantran";
const BUCKET_SCHEMA_VERSION = "1.0.0";

// Approved artifact types for Niyantran's use cases (from bhiv-bucket/governance/artifacts.py).
// Niyantran produces: execution_metadata, agent_outputs (screenshots/exports), audit_trails, event_records.
const ARTIFACT_TYPES = {
  SCREENSHOT: "agent_outputs",       // Employee screen captures
  EXPORT: "agent_outputs",           // Data exports (salary, attendance PDFs)
  AUDIT_TRAIL: "audit_trails",       // Compliance audit records
  EVENT_RECORD: "event_records",     // Behavioral events (pre-KARMA signal)
  EXECUTION_METADATA: "execution_metadata",
};

// ─────────────────────────────────────────────────────────────────────────────
// HTTP client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an authenticated axios instance for Bucket.
 * Called lazily so missing env vars produce a clear error at call time,
 * not at module load time (Bucket integration is additive, server boots without it).
 */
function buildHttpClient() {
  if (!BUCKET_BASE_URL) {
    throw new Error(
      "[bucketClient] BUCKET_BASE_URL is not set. " +
      "Set it to the Bucket service URL (e.g. https://bhiv-bucket-i1l6.onrender.com)."
    );
  }

  const headers = {
    "Content-Type": "application/json",
    "x-source": "niyantran",  // Identifies Niyantran to downstream services
  };
  // API key is optional — Bucket on Render has no key auth
  if (BUCKET_API_KEY) {
    headers["x-api-key"] = BUCKET_API_KEY;
  }

  return axios.create({
    baseURL: BUCKET_BASE_URL,
    timeout: BUCKET_TIMEOUT_MS,
    headers,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Governance queries — always ask Bucket, never re-derive locally
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check Bucket's artifact admission policy.
 * Call this once at startup to confirm Niyantran's artifact types are approved.
 * @returns {Promise<Object>} Bucket's artifact policy
 */
async function getArtifactPolicy() {
  const client = buildHttpClient();
  const res = await client.get("/governance/artifacts/policy");
  return res.data;
}

/**
 * Validate that an artifact is admissible before writing it.
 * This calls Bucket's own admission validation — do not replicate this logic locally.
 *
 * @param {string} artifactType - One of ARTIFACT_TYPES values
 * @param {number} payloadSizeBytes - Size of the payload to be stored
 * @returns {Promise<{valid: boolean, reason?: string}>}
 */
async function validateArtifactAdmission(artifactType, payloadSizeBytes) {
  const client = buildHttpClient();
  try {
    const res = await client.post("/governance/gate/validate-operation", null, {
      params: {
        operation_type: "CREATE",
        artifact_class: artifactType,
        data_size: payloadSizeBytes,
        integration_id: NIYANTRAN_INTEGRATION_ID,
      },
    });
    return { valid: true, response: res.data };
  } catch (err) {
    if (err.response?.status === 403) {
      return {
        valid: false,
        reason: err.response.data?.detail?.reason || "governance_rejected",
      };
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact envelope builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a Bucket-compliant ArtifactEnvelope.
 * Shape matches bhiv-bucket's Pydantic model exactly:
 *   artifact_id, trace_id, timestamp_utc, schema_version,
 *   source_module_id, artifact_type, parent_hash (optional), payload
 *
 * Bucket computes the hash server-side — do NOT set a hash field here.
 *
 * @param {Object} opts
 * @param {string} opts.artifactType - One of ARTIFACT_TYPES values
 * @param {string} opts.traceId      - Correlation trace ID (from req context)
 * @param {Object} opts.payload      - Artifact payload (JSON-serialisable)
 * @param {string} [opts.parentHash] - Hash of the preceding artifact in the chain
 * @returns {Object} ArtifactEnvelope
 */
function buildArtifactEnvelope({ artifactType, traceId, payload, parentHash }) {
  return {
    artifact_id: randomUUID(),
    trace_id: traceId || randomUUID(),
    timestamp_utc: new Date().toISOString(),
    schema_version: BUCKET_SCHEMA_VERSION,
    source_module_id: NIYANTRAN_REQUESTER_ID,
    artifact_type: artifactType,
    parent_hash: parentHash || null,
    payload,
    // NOTE: do NOT include a "hash" field — Bucket ignores client hashes by design.
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core write operation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write an artifact to Bucket using the contract write endpoint.
 * Always validates admission first; rejects without writing if Bucket says no.
 *
 * @param {Object} opts
 * @param {string} opts.artifactType - One of ARTIFACT_TYPES values
 * @param {string} opts.traceId      - Correlation trace ID
 * @param {Object} opts.payload      - Artifact payload
 * @param {string} [opts.parentHash] - Parent artifact hash (for chain linking)
 * @returns {Promise<{
 *   success: boolean,
 *   artifact_id: string,
 *   hash: string,
 *   parent_hash: string|null,
 *   timestamp_utc: string,
 *   storage_type: string
 * }>}
 */
async function writeArtifact({ artifactType, traceId, payload, parentHash }) {
  const client = buildHttpClient();

  const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");

  // Step 1: validate admission via Bucket's governance gate.
  const admission = await validateArtifactAdmission(artifactType, payloadBytes);
  if (!admission.valid) {
    const err = new Error(
      `[bucketClient] Artifact admission rejected by Bucket governance: ${admission.reason}`
    );
    err.code = "BUCKET_ADMISSION_REJECTED";
    err.reason = admission.reason;
    throw err;
  }

  // Step 2: build the envelope.
  const artifact = buildArtifactEnvelope({ artifactType, traceId, payload, parentHash });

  // Step 3: write via the contract endpoint.
  const body = {
    requester_id: NIYANTRAN_REQUESTER_ID,
    integration_id: NIYANTRAN_INTEGRATION_ID,
    artifact,
  };

  const res = await client.post("/bucket/artifacts/write", body);

  if (!res.data.success) {
    const err = new Error(
      `[bucketClient] Bucket write failed: ${res.data.error}`
    );
    err.code = "BUCKET_WRITE_FAILED";
    err.bucketResponse = res.data;
    throw err;
  }

  return res.data.data; // { artifact_id, hash, parent_hash, timestamp_utc, storage_type }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience wrappers for Niyantran's specific artifact types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Store a screenshot artifact in Bucket.
 * Called from server/services/screenCapture.js for new captures.
 * Does NOT replace existing Cloudinary writes — call this alongside them
 * until Cloudinary is explicitly deprecated.
 *
 * @param {Object} opts
 * @param {string} opts.userId       - Employee user ID
 * @param {string} opts.sessionId    - Work session ID
 * @param {string} opts.imageBase64  - Base64-encoded screenshot
 * @param {Object} [opts.metadata]   - Additional metadata (dimensions, OCR, etc.)
 * @param {string} [opts.traceId]    - Request trace ID
 * @returns {Promise<Object>} Bucket write result
 */
async function storeScreenshot({ userId, sessionId, imageBase64, metadata = {}, traceId }) {
  return writeArtifact({
    artifactType: ARTIFACT_TYPES.SCREENSHOT,
    traceId: traceId || randomUUID(),
    payload: {
      user_id: userId,
      session_id: sessionId,
      image_base64: imageBase64,
      captured_at: new Date().toISOString(),
      metadata,
    },
  });
}

/**
 * Store a data export artifact (salary report, attendance export, etc.) in Bucket.
 *
 * @param {Object} opts
 * @param {string} opts.exportType   - e.g. "salary_report", "attendance_export"
 * @param {string} opts.generatedBy  - User ID who triggered the export
 * @param {Object} opts.data         - Export data (JSON-serialisable summary)
 * @param {string} [opts.traceId]
 * @returns {Promise<Object>} Bucket write result
 */
async function storeExport({ exportType, generatedBy, data, traceId }) {
  return writeArtifact({
    artifactType: ARTIFACT_TYPES.EXPORT,
    traceId: traceId || randomUUID(),
    payload: {
      export_type: exportType,
      generated_by: generatedBy,
      generated_at: new Date().toISOString(),
      data,
    },
  });
}

/**
 * Store a behavioral event record in Bucket.
 * This is the Niyantran → Bucket leg of the KARMA routing path.
 * Bucket holds this event; KARMA's authorization only accepts events
 * from Bucket (x-source: bucket) — so Bucket acts as the relay.
 *
 * NOTE: Niyantran writes the event TO Bucket. Whether Bucket then
 * forwards it to KARMA is Bucket's concern, not Niyantran's.
 * Niyantran does not call KARMA directly (authorization.py enforces this).
 *
 * @param {Object} opts
 * @param {string} opts.subjectId       - Employee UUID (maps to KARMA subject_id)
 * @param {string} opts.signal          - "allow"|"nudge"|"restrict"|"escalate"
 * @param {number} opts.severity        - 0.0 to 1.0
 * @param {number} opts.ttl             - Seconds (minimum 1)
 * @param {string} opts.opaqueReasonCode - Opaque reason code (no human-readable text per contract)
 * @param {string} [opts.traceId]
 * @returns {Promise<Object>} Bucket write result
 */
async function storeKarmaEventRecord({
  subjectId,
  signal,
  severity,
  ttl,
  opaqueReasonCode,
  traceId,
}) {
  // Validate against karma_signal_contract.json before writing.
  const validSignals = ["allow", "nudge", "restrict", "escalate"];
  if (!validSignals.includes(signal)) {
    throw new Error(
      `[bucketClient] Invalid signal value "${signal}". Must be one of: ${validSignals.join(", ")}`
    );
  }
  if (typeof severity !== "number" || severity < 0.0 || severity > 1.0) {
    throw new Error(
      `[bucketClient] Invalid severity "${severity}". Must be a number between 0.0 and 1.0.`
    );
  }
  if (!Number.isInteger(ttl) || ttl < 1) {
    throw new Error(
      `[bucketClient] Invalid ttl "${ttl}". Must be an integer >= 1.`
    );
  }

  return writeArtifact({
    artifactType: ARTIFACT_TYPES.EVENT_RECORD,
    traceId: traceId || randomUUID(),
    payload: {
      // Canonical signal contract fields (karma_signal_contract.json v1.0.0)
      subject_id: subjectId,
      product_context: "workflow",   // Confirmed: B2 resolved as "workflow"
      signal,
      severity,
      ttl,
      requires_core_ack: true,       // MUST always be true per contract
      opaque_reason_code: opaqueReasonCode,
      emitted_at: new Date().toISOString(),
      source: "niyantran",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check Bucket service health.
 * @returns {Promise<{healthy: boolean, status: string, details?: Object}>}
 */
async function checkHealth() {
  try {
    const client = buildHttpClient();
    const res = await client.get("/health");
    return {
      healthy: res.data.status === "healthy" || res.data.status === "degraded",
      status: res.data.status,
      details: res.data,
    };
  } catch (err) {
    return {
      healthy: false,
      status: "unreachable",
      error: err.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  writeArtifact,
  storeScreenshot,
  storeExport,
  storeKarmaEventRecord,
  getArtifactPolicy,
  validateArtifactAdmission,
  checkHealth,
  ARTIFACT_TYPES,
  // Exported for tests
  buildArtifactEnvelope,
  NIYANTRAN_INTEGRATION_ID,
  NIYANTRAN_REQUESTER_ID,
};
