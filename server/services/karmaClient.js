/**
 * karmaClient.js
 *
 * Niyantran's client for publishing KARMA behavioral signals.
 *
 * ── CRITICAL ARCHITECTURE NOTE ──────────────────────────────────────────────
 * KARMA (Karma-Tracker) runs with BUCKET_ONLY_MODE = True.
 * ALL signal endpoints (/api/v1/log-action/, /api/v1/karma/, etc.) are
 * restricted to x-source: bucket|core|internal (Karma-Tracker/karma-tracker/
 * utils/authorization.py, RESTRICTED_ENDPOINTS list).
 *
 * Niyantran CANNOT call KARMA directly — requests from x-source: niyantran
 * are rejected with 403 by KARMA's authorization middleware.
 *
 * Flow:
 *   Niyantran → bucketClient.storeKarmaEventRecord() → Bucket /bucket/artifacts/write
 *                        ↓ (Bucket's concern, not Niyantran's)
 *                      KARMA
 *
 * This client's job is to:
 *   1. Map Niyantran's existing behavioral data into the canonical signal shape.
 *   2. Validate the signal against karma_signal_contract.json before writing.
 *   3. Delegate the actual write to bucketClient (which routes to Bucket).
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Signal contract reference: Karma-Tracker/karma-tracker/karma_signal_contract.json v1.0.0
 * Required fields: subject_id, product_context, signal, severity, ttl,
 *                  requires_core_ack (must be true), opaque_reason_code
 */

"use strict";

const { storeKarmaEventRecord } = require("./bucketClient");

// ─────────────────────────────────────────────────────────────────────────────
// Contract constants (from karma_signal_contract.json v1.0.0)
// ─────────────────────────────────────────────────────────────────────────────

const SIGNALS = Object.freeze({
  ALLOW: "allow",
  NUDGE: "nudge",
  RESTRICT: "restrict",
  ESCALATE: "escalate",
});

// product_context confirmed as "workflow" (B2 resolved).
const PRODUCT_CONTEXT = "workflow";

// Default TTL for Niyantran events (seconds). 5 minutes.
// Override per event type as needed.
const DEFAULT_TTL = 300;

// ─────────────────────────────────────────────────────────────────────────────
// Opaque reason codes for Niyantran's behavioral events
// These are opaque identifiers — no human-readable text per the contract.
// ─────────────────────────────────────────────────────────────────────────────
const REASON_CODES = Object.freeze({
  // Monitoring signals
  EXCESSIVE_IDLE:       "NIY_MON_001",
  DISALLOWED_SITE:      "NIY_MON_002",
  KEYSTROKE_ANOMALY:    "NIY_MON_003",
  SCREEN_CAPTURE_ALERT: "NIY_MON_004",
  // Attendance signals
  LATE_CHECKIN:         "NIY_ATT_001",
  EARLY_CHECKOUT:       "NIY_ATT_002",
  ATTENDANCE_ANOMALY:   "NIY_ATT_003",
  // EMS signals
  EMS_IDLE_THRESHOLD:   "NIY_EMS_001",
  EMS_MOUSE_INACTIVE:   "NIY_EMS_002",
  EMS_APP_SWITCH:       "NIY_EMS_003",
  // Normal operation
  NORMAL_ACTIVITY:      "NIY_NRM_001",
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation (contract-first: validate before any write)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a signal payload against karma_signal_contract.json v1.0.0.
 * Throws if any required field is missing or invalid.
 * Call this before storeKarmaEventRecord — it provides a clear error
 * at the mapping layer, before the write attempt.
 *
 * @param {Object} signal
 * @throws {Error} with a descriptive message listing all violations
 */
function validateSignal(signal) {
  const violations = [];

  if (!signal.subject_id || typeof signal.subject_id !== "string") {
    violations.push("subject_id: required string (UUID of the subject)");
  }
  if (signal.product_context !== PRODUCT_CONTEXT) {
    violations.push(`product_context: must be "${PRODUCT_CONTEXT}", got "${signal.product_context}"`);
  }
  if (!["allow", "nudge", "restrict", "escalate"].includes(signal.signal)) {
    violations.push(`signal: must be one of [allow, nudge, restrict, escalate], got "${signal.signal}"`);
  }
  if (typeof signal.severity !== "number" || signal.severity < 0.0 || signal.severity > 1.0) {
    violations.push(`severity: must be number 0.0–1.0, got "${signal.severity}"`);
  }
  if (!Number.isInteger(signal.ttl) || signal.ttl < 1) {
    violations.push(`ttl: must be integer >= 1, got "${signal.ttl}"`);
  }
  if (signal.requires_core_ack !== true) {
    violations.push("requires_core_ack: must be true (all signals require Core ACK per contract)");
  }
  if (!signal.opaque_reason_code || typeof signal.opaque_reason_code !== "string") {
    violations.push("opaque_reason_code: required string");
  }

  if (violations.length > 0) {
    throw new Error(
      `[karmaClient] Signal contract violations:\n${violations.map(v => "  - " + v).join("\n")}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core publish function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Publish a canonical KARMA signal.
 * Validates against the contract, then routes through Bucket
 * (Niyantran cannot reach KARMA directly — see architecture note above).
 *
 * @param {Object} opts
 * @param {string} opts.subjectId       - Employee user ID (UUID)
 * @param {string} opts.signal          - SIGNALS.ALLOW | NUDGE | RESTRICT | ESCALATE
 * @param {number} opts.severity        - 0.0 to 1.0
 * @param {number} opts.ttl             - Seconds >= 1
 * @param {string} opts.opaqueReasonCode - One of REASON_CODES values
 * @param {string} [opts.traceId]       - Correlation trace ID from request context
 * @returns {Promise<Object>} Bucket write result (Bucket is the relay to KARMA)
 */
async function publishSignal({
  subjectId,
  signal,
  severity,
  ttl = DEFAULT_TTL,
  opaqueReasonCode,
  traceId,
}) {
  const payload = {
    subject_id: subjectId,
    product_context: PRODUCT_CONTEXT,
    signal,
    severity,
    ttl,
    requires_core_ack: true,   // Always true per contract
    opaque_reason_code: opaqueReasonCode,
  };

  // Contract-first: validate before writing.
  validateSignal(payload);

  return storeKarmaEventRecord({
    subjectId,
    signal,
    severity,
    ttl,
    opaqueReasonCode,
    traceId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain-specific signal factories
// Map Niyantran's existing behavioral data into canonical signal shapes.
// These are the ONLY place where Niyantran-internal concepts are translated
// to the KARMA contract. Do not add mapping logic elsewhere.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signal: employee idle time exceeded threshold.
 * Sources: server/routes/emsSignals.js idle events.
 *
 * @param {string} userId
 * @param {number} idleMinutes
 * @param {string} [traceId]
 */
async function signalExcessiveIdle(userId, idleMinutes, traceId) {
  // Severity scales linearly: 15 min idle = 0.3, 60 min = 1.0
  const severity = Math.min(1.0, Math.round((idleMinutes / 60) * 100) / 100);
  const signal = idleMinutes >= 30 ? SIGNALS.RESTRICT : SIGNALS.NUDGE;

  return publishSignal({
    subjectId: userId,
    signal,
    severity,
    ttl: 600,
    opaqueReasonCode: REASON_CODES.EXCESSIVE_IDLE,
    traceId,
  });
}

/**
 * Signal: employee visited a disallowed website.
 * Sources: server/routes/monitoring.js website monitoring.
 *
 * @param {string} userId
 * @param {string} [traceId]
 */
async function signalDisallowedSite(userId, traceId) {
  return publishSignal({
    subjectId: userId,
    signal: SIGNALS.RESTRICT,
    severity: 0.8,
    ttl: 300,
    opaqueReasonCode: REASON_CODES.DISALLOWED_SITE,
    traceId,
  });
}

/**
 * Signal: keystroke anomaly detected.
 * Sources: server/routes/emsSignals.js keystroke events.
 *
 * @param {string} userId
 * @param {number} anomalyScore - 0.0 to 1.0
 * @param {string} [traceId]
 */
async function signalKeystrokeAnomaly(userId, anomalyScore, traceId) {
  return publishSignal({
    subjectId: userId,
    signal: anomalyScore >= 0.7 ? SIGNALS.ESCALATE : SIGNALS.NUDGE,
    severity: Math.min(1.0, anomalyScore),
    ttl: 300,
    opaqueReasonCode: REASON_CODES.KEYSTROKE_ANOMALY,
    traceId,
  });
}

/**
 * Signal: normal activity (allow signal, low severity).
 * Publish periodically to confirm the session is in good standing.
 *
 * @param {string} userId
 * @param {string} [traceId]
 */
async function signalNormalActivity(userId, traceId) {
  return publishSignal({
    subjectId: userId,
    signal: SIGNALS.ALLOW,
    severity: 0.0,
    ttl: DEFAULT_TTL,
    opaqueReasonCode: REASON_CODES.NORMAL_ACTIVITY,
    traceId,
  });
}

/**
 * Signal: late check-in.
 * Sources: server/routes/attendance.js check-in time comparison.
 *
 * @param {string} userId
 * @param {number} minutesLate
 * @param {string} [traceId]
 */
async function signalLateCheckin(userId, minutesLate, traceId) {
  const severity = Math.min(1.0, Math.round((minutesLate / 120) * 100) / 100);

  return publishSignal({
    subjectId: userId,
    signal: minutesLate > 60 ? SIGNALS.RESTRICT : SIGNALS.NUDGE,
    severity,
    ttl: DEFAULT_TTL,
    opaqueReasonCode: REASON_CODES.LATE_CHECKIN,
    traceId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Core
  publishSignal,
  validateSignal,
  // Domain-specific factories
  signalExcessiveIdle,
  signalDisallowedSite,
  signalKeystrokeAnomaly,
  signalNormalActivity,
  signalLateCheckin,
  // Constants (exported for tests and callers)
  SIGNALS,
  PRODUCT_CONTEXT,
  REASON_CODES,
  DEFAULT_TTL,
};
