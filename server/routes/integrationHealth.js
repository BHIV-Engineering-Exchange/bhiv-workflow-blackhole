/**
 * integrationHealth.js
 *
 * Exposes GET /api/integration/health — a single endpoint that reports the
 * reachability and configuration state of every TANTRA ecosystem service
 * that Niyantran integrates with.
 *
 * Services checked:
 *   - Bucket (bhiv-bucket)  — artifact storage, KARMA relay
 *   - PRANA (bhiv_prana)     — session telemetry (B6 gap: endpoint not yet built)
 *   - KARMA (Karma-Tracker) — behavioral signals (routed via Bucket, not direct)
 *
 * Auth: requires admin JWT (auth + adminAuth middleware).
 * This endpoint never throws — every probe is wrapped and returns a status object.
 */

"use strict";

const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const adminAuth = require("../middleware/adminAuth");

// Lazy-require so missing env vars don't crash module load
// (Bucket integration is additive — server must boot without it).
let bucketClient;
try {
  bucketClient = require("../services/bucketClient");
} catch (e) {
  bucketClient = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Probes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Probe Bucket health and governance policy access.
 * @returns {Promise<Object>}
 */
async function probeBucket() {
  if (!bucketClient) {
    return {
      healthy: false,
      status: "module_load_failed",
      reason: "bucketClient.js failed to load — check BUCKET_BASE_URL and BUCKET_API_KEY env vars",
    };
  }

  const result = { healthy: false, status: "unknown" };

  try {
    const health = await bucketClient.checkHealth();
    result.healthy = health.healthy;
    result.status = health.status;
    if (health.details) result.details = health.details;
    if (health.error) result.error = health.error;
  } catch (err) {
    result.status = "error";
    result.error = err.message;
  }

  // Also report whether governance policy endpoint is accessible
  try {
    const policy = await bucketClient.getArtifactPolicy();
    result.governance_policy_accessible = true;
    result.governance_policy = policy;
  } catch (err) {
    result.governance_policy_accessible = false;
    result.governance_policy_error = err.message;
  }

  return result;
}

/**
 * Probe PRANA health.
 * B6 gap: PRANA's /prana/ingest is stateless forwarding only.
 * Session-telemetry endpoint doesn't exist yet.
 * @returns {Promise<Object>}
 */
async function probePrana() {
  const pranaBaseUrl = process.env.PRANA_BASE_URL;

  if (!pranaBaseUrl) {
    return {
      healthy: false,
      status: "not_configured",
      reason: "PRANA_BASE_URL env var not set",
    };
  }

  try {
    const axios = require("axios");
    const res = await axios.get(`${pranaBaseUrl}/health`, { timeout: 3000 });
    return {
      healthy: res.data?.status === "healthy",
      status: res.data?.status || "unknown",
      details: res.data,
      note: "PRANA session-telemetry endpoint not yet available (B6 gap). Only stateless forwarding works.",
    };
  } catch (err) {
    return {
      healthy: false,
      status: "unreachable",
      error: err.message,
      note: "PRANA session-telemetry endpoint not yet available (B6 gap)",
    };
  }
}

/**
 * Report KARMA routing status.
 * Niyantran does NOT call KARMA directly (authorization.py blocks it).
 * All events route through Bucket → KARMA.
 * @returns {Object}
 */
function reportKarmaRouting() {
  return {
    routed_via_bucket: true,
    direct_access: false,
    note: "KARMA's authorization.py restricts all signal endpoints to x-source: bucket|core|internal. " +
          "Niyantran routes events through bucketClient.storeKarmaEventRecord() → Bucket → KARMA.",
    authorized_sources: ["bucket", "core", "internal"],
    niyantran_source_header: "niyantran (not authorized for direct access)",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/integration/health
 *
 * Returns the health/configuration status of all TANTRA ecosystem services.
 * Admin-only (requires valid JWT with Admin role).
 */
router.get("/health", auth, adminAuth, async (req, res) => {
  const [bucket, prana] = await Promise.all([probeBucket(), probePrana()]);
  const karma = reportKarmaRouting();

  const envConfigured = {
    BUCKET_BASE_URL: Boolean(process.env.BUCKET_BASE_URL),
    BUCKET_API_KEY: Boolean(process.env.BUCKET_API_KEY),
    PRANA_BASE_URL: Boolean(process.env.PRANA_BASE_URL),
    PRANA_API_KEY: Boolean(process.env.PRANA_API_KEY),
    TANTRA_EXECUTION_KEY: Boolean(process.env.TANTRA_EXECUTION_KEY),
  };

  // Overall status: healthy only if Bucket is healthy (Bucket is the critical path)
  const overallHealthy = bucket.healthy;

  res.json({
    status: overallHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      bucket,
      prana,
      karma,
    },
    env_configured: envConfigured,
    architecture_notes: {
      phase_ordering: "Bucket must be active before KARMA signal flow (KARMA authorization blocks non-bucket sources)",
      prana_gap: "PRANA /prana/ingest is stateless forwarding only — no session telemetry endpoint yet (B6)",
      cloudinary: "Existing Cloudinary storage untouched — Bucket integration is additive only (B3)",
      product_context: "workflow (B2 — confirmed enum value in karma_signal_contract.json)",
    },
  });
});

module.exports = router;
