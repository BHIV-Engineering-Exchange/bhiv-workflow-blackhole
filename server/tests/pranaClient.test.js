/**
 * pranaClient.test.js
 *
 * Unit tests for Niyantran's PRANA service client using Node.js native test runner.
 */

"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const pranaClient = require("../services/pranaClient");

describe("pranaClient", () => {
  const originalFetch = global.fetch;
  let lastFetchCall = null;

  afterEach(() => {
    global.fetch = originalFetch;
    lastFetchCall = null;
  });

  describe("checkHealth", () => {
    it("reports healthy when PRANA returns status: healthy", async () => {
      global.fetch = async (url, opts) => {
        lastFetchCall = { url, opts };
        return {
          status: 200,
          json: async () => ({ status: "healthy", service: "bhiv-prana", forwarding_enabled: true }),
        };
      };

      const health = await pranaClient.checkHealth();
      assert.equal(health.healthy, true);
      assert.equal(health.status, "healthy");
      assert.ok(health.details);
    });

    it("reports unreachable when connection fails (never crashes)", async () => {
      global.fetch = async () => {
        throw new Error("ECONNREFUSED");
      };

      const health = await pranaClient.checkHealth();
      assert.equal(health.healthy, false);
      assert.equal(health.status, "unreachable");
      assert.ok(health.error.includes("ECONNREFUSED"));
    });
  });

  describe("checkReadiness", () => {
    it("reports ready: true when /ready returns 200 and ready: true", async () => {
      global.fetch = async () => ({
        status: 200,
        json: async () => ({ ready: true, status: "ready" }),
      });

      const res = await pranaClient.checkReadiness();
      assert.equal(res.ready, true);
      assert.equal(res.status, "ready");
    });

    it("reports ready: false when /ready returns 503 or fails", async () => {
      global.fetch = async () => ({
        status: 503,
        json: async () => ({ ready: false, status: "unready" }),
      });

      const res = await pranaClient.checkReadiness();
      assert.equal(res.ready, false);
      assert.equal(res.status, "unready");
    });
  });

  describe("sendTelemetry", () => {
    it("successfully sends telemetry and propagates x-trace-id", async () => {
      global.fetch = async (url, opts) => {
        lastFetchCall = { url, opts };
        return {
          status: 200,
          json: async () => ({ status: "forwarded", event_id: "evt-123" }),
        };
      };

      const packet = {
        user_id: "emp-test",
        session_id: "sess-test",
        focus_score: 90,
      };

      const res = await pranaClient.sendTelemetry(packet, { traceId: "test-trace-123" });
      assert.equal(res.success, true);
      assert.equal(res.data.status, "forwarded");
      assert.equal(lastFetchCall.url, "http://localhost:8103/prana/ingest");
      assert.equal(lastFetchCall.opts.method, "POST");
      assert.equal(lastFetchCall.opts.headers["x-trace-id"], "test-trace-123");
    });

    it("safely handles network errors without crashing caller", async () => {
      global.fetch = async () => {
        throw new Error("ETIMEDOUT");
      };

      const res = await pranaClient.sendTelemetry({ user_id: "emp-1" });
      assert.equal(res.success, false);
      assert.equal(res.error, "ETIMEDOUT");
    });
  });

  describe("fetchReplay", () => {
    it("retrieves stored replay document", async () => {
      global.fetch = async () => ({
        ok: true,
        json: async () => ({ trace_id: "trace-999", certification_status: "CERTIFIED" }),
      });

      const doc = await pranaClient.fetchReplay("trace-999");
      assert.ok(doc);
      assert.equal(doc.trace_id, "trace-999");
    });

    it("returns null on 404 or failure", async () => {
      global.fetch = async () => ({
        ok: false,
        status: 404,
      });

      const doc = await pranaClient.fetchReplay("trace-missing");
      assert.equal(doc, null);
    });
  });
});
