/**
 * setuDispatcher.js — outbound Sampada SETU niyantran_telemetry (2026-07-02 closeout).
 * Additive dispatcher; fires after ExecutionEvent persist.
 */

const axios = require("axios");
const crypto = require("crypto");

const SIGNAL_TYPE = "niyantran_telemetry";

function buildSampadaBody(executionEvent, correlationId) {
  const traceId = executionEvent.traceId;
  if (!traceId) {
    throw new Error("traceId required for Sampada SETU dispatch");
  }
  return {
    signal_type: SIGNAL_TYPE,
    payload: {
      event_id: executionEvent.eventId,
      execution_id: executionEvent.executionId,
      tenant_id: executionEvent.tenantId,
      event_type: executionEvent.eventType,
      event_index: executionEvent.eventIndex,
      event_timestamp: executionEvent.eventTimestamp,
      event_payload: executionEvent.payload || {},
    },
    workforce_ref_id: executionEvent.payload?.workforce_ref_id || null,
    source_declaration: "niyantran telemetry participation",
    origin_system: "niyantran",
    owning_system: "niyantran",
    trace_id: traceId,
    correlation_id: correlationId || crypto.randomUUID(),
    trust_classification: "observed",
    visibility_scope: "tenant",
  };
}

async function dispatchToSampada(executionEvent, options = {}) {
  if (process.env.SAMPADA_SETU_ENABLED !== "true") {
    return { dispatched: false, reason: "SAMPADA_SETU_ENABLED is false" };
  }

  const baseUrl = (process.env.SAMPADA_SETU_BASE_URL || "").replace(/\/$/, "");
  const apiKey = process.env.SAMPADA_SETU_API_KEY || "";
  if (!baseUrl || !apiKey) {
    return { dispatched: false, reason: "missing SAMPADA_SETU_BASE_URL or SAMPADA_SETU_API_KEY" };
  }

  const body = buildSampadaBody(executionEvent, options.correlationId);
  const url = `${baseUrl}/v1/setu/signals/${SIGNAL_TYPE}`;
  const timeout = parseInt(process.env.SAMPADA_SETU_TIMEOUT_MS || "30000", 10);

  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout,
    });
    return {
      dispatched: response.status === 200,
      request: { method: "POST", url, body },
      response: { status: response.status, body: response.data },
    };
  } catch (error) {
    return {
      dispatched: false,
      reason: error.message,
      request: { method: "POST", url, body },
      response: {
        status: error.response?.status || null,
        body: error.response?.data || null,
      },
    };
  }
}

module.exports = { dispatchToSampada, buildSampadaBody };
