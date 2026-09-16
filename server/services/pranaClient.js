/**
 * pranaClient.js
 *
 * Niyantran's client for BHIV PRANA (bhiv-prana FastAPI service).
 * Provides safe, non-blocking telemetry propagation, health checks, and replay lookups.
 * Built using native fetch (zero external dependencies, resilient against broken node_modules).
 */

"use strict";

const { randomUUID } = require("crypto");

const PRANA_BASE_URL = (process.env.PRANA_BASE_URL || "http://localhost:8103").replace(/\/+$/, "");
const PRANA_API_KEY = process.env.PRANA_API_KEY;
const PRANA_TIMEOUT_MS = parseInt(process.env.PRANA_TIMEOUT_MS || "10000", 10);

async function _fetchWithTimeout(resource, options = {}) {
  const timeout = options.timeout || PRANA_TIMEOUT_MS;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Check PRANA health status.
 * Never throws â”€ returns structured status on network failure.
 * @returns {Promise<{ healthy: boolean, status: string, details?: object, error?: string }>}
 */
async function checkHealth() {
  try {
    const res = await _fetchWithTimeout(`${PRANA_BASE_URL}/health`);
    const data = await res.json().catch(() => ({}));
    return {
      healthy: res.status === 200 && data.status === "healthy",
      status: data.status || "unknown",
      details: data,
    };
  } catch (err) {
    return {
      healthy: false,
      status: "unreachable",
      error: err.message,
    };
  }
}

/**
 * Check PRANA readiness probe (indicates whether storage is fully operational).
 * @returns {Promise<{ ready: boolean, status: string, details?: object, error?: string }>}
 */
async function checkReadiness() {
  try {
    const res = await _fetchWithTimeout(`${PRANA_BASE_URL}/ready`);
    const data = await res.json().catch(() => ({}));
    return {
      ready: res.status === 200 && Boolean(data.ready),
      status: data.status || "unready",
      details: data,
    };
  } catch (err) {
    return {
      ready: false,
      status: "unready",
      error: err.message,
    };
  }
}

/**
 * Send telemetry packet to PRANA.
 * Never throws â”€ returns structured result to ensure telemetry outages never block caller.
 * @param {object} packet - Telemetry packet (user_id, session_id, focus_score, raw_signals, etc.)
 * @param {object} [options] - Optional trace context overrides
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
async function sendTelemetry(packet, options = {}) {
  try {
    const traceId = options.traceId || packet.trace_id || `niyantran-${randomUUID()}`;
    const headers = {
      "Content-Type": "application/json",
      "x-source": "niyantran",
      "x-trace-id": traceId,
    };
    if (PRANA_API_KEY) headers["x-prana-api-key"] = PRANA_API_KEY;
    if (options.traceparent) headers["traceparent"] = options.traceparent;
    if (options.tracestate) headers["tracestate"] = options.tracestate;

    const packetToSend = { ...packet, trace_id: traceId };
    const res = await _fetchWithTimeout(`${PRANA_BASE_URL}/prana/ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify(packetToSend),
    });

    const data = await res.json().catch(() => null);
    return {
      success: res.status >= 200 && res.status < 300,
      data,
      traceId,
    };
  } catch (err) {
    console.warn(`[pranaClient] Telemetry dispatch failed (non-blocking): ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Fetch stored replay document from PRANA.
 * @param {string} traceId - Trace identifier to fetch
 * @returns {Promise<object|null>}
 */
async function fetchReplay(traceId) {
  if (!traceId) return null;
  try {
    const headers = {};
    if (PRANA_API_KEY) headers["x-prana-api-key"] = PRANA_API_KEY;
    const res = await _fetchWithTimeout(`${PRANA_BASE_URL}/replay/${encodeURIComponent(traceId)}`, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

module.exports = {
  checkHealth,
  checkReadiness,
  sendTelemetry,
  fetchReplay,
};
