/**
 * integrationHealth.test.js
 *
 * Tests for GET /api/integration/health — the TANTRA ecosystem health endpoint.
 *
 * Strategy:
 *   - Builds a minimal Express app mounting only the integration health router.
 *   - Mocks bucketClient, axios (for PRANA probe), and auth middleware.
 *   - Validates response shape, status codes, and all documented response body
 *     fields from the implementation plan.
 *
 * Response body verified at each step per the audit plan.
 */

"use strict";

// ── Env stubs ────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-only";
process.env.TANTRA_EXECUTION_KEY = "test-tantra-key-for-unit-tests-only";
process.env.MONGODB_URI = "mongodb://localhost:27017/test";
process.env.BUCKET_BASE_URL = "http://test-bucket:8001";
process.env.BUCKET_API_KEY = "test-bucket-api-key";
process.env.PRANA_BASE_URL = "http://test-prana:8002";
process.env.PRANA_API_KEY = "test-prana-api-key";

const request = require("supertest");
const express = require("express");

// ── Mock auth middleware (pass-through for tests) ────────────────────────────
jest.mock("../middleware/auth", () => (req, res, next) => {
  req.user = { id: "test-admin", role: "Admin" };
  next();
});
jest.mock("../middleware/adminAuth", () => (req, res, next) => next());

// ── Mock bucketClient ────────────────────────────────────────────────────────
const mockCheckHealth = jest.fn();
const mockGetArtifactPolicy = jest.fn();

jest.mock("../services/bucketClient", () => ({
  checkHealth: mockCheckHealth,
  getArtifactPolicy: mockGetArtifactPolicy,
}));

// ── Mock axios (for PRANA probe) ─────────────────────────────────────────────
const mockAxiosGet = jest.fn();
jest.mock("axios", () => ({
  get: mockAxiosGet,
}));

// ── Build test app ───────────────────────────────────────────────────────────
const integrationHealthRouter = require("../routes/integrationHealth");
const app = express();
app.use(express.json());
app.use("/api/integration", integrationHealthRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Test suites
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/integration/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Response shape ──────────────────────────────────────────────────────

  it("returns 200 with the correct top-level response shape", async () => {
    mockCheckHealth.mockResolvedValueOnce({
      healthy: true,
      status: "healthy",
      details: { status: "healthy", bucket_version: "1.0.0" },
    });
    mockGetArtifactPolicy.mockResolvedValueOnce({ approved_types: ["agent_outputs"] });
    mockAxiosGet.mockResolvedValueOnce({
      data: { status: "healthy", service: "bhiv-prana" },
    });

    const res = await request(app).get("/api/integration/health").expect(200);

    // Top-level fields
    expect(res.body.status).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.services).toBeDefined();
    expect(res.body.env_configured).toBeDefined();
    expect(res.body.architecture_notes).toBeDefined();

    // Service sections
    expect(res.body.services.bucket).toBeDefined();
    expect(res.body.services.prana).toBeDefined();
    expect(res.body.services.karma).toBeDefined();
  });

  // ── Bucket healthy ─────────────────────────────────────────────────────

  it("reports overall status 'healthy' when Bucket is healthy", async () => {
    mockCheckHealth.mockResolvedValueOnce({
      healthy: true,
      status: "healthy",
      details: { status: "healthy", bucket_version: "1.0.0" },
    });
    mockGetArtifactPolicy.mockResolvedValueOnce({ approved_types: ["agent_outputs"] });
    mockAxiosGet.mockResolvedValueOnce({
      data: { status: "healthy" },
    });

    const res = await request(app).get("/api/integration/health").expect(200);

    expect(res.body.status).toBe("healthy");
    expect(res.body.services.bucket.healthy).toBe(true);
    expect(res.body.services.bucket.status).toBe("healthy");
    expect(res.body.services.bucket.governance_policy_accessible).toBe(true);
  });

  // ── Bucket degraded ────────────────────────────────────────────────────

  it("reports overall status 'degraded' when Bucket is unreachable", async () => {
    mockCheckHealth.mockResolvedValueOnce({
      healthy: false,
      status: "unreachable",
      error: "ECONNREFUSED",
    });
    mockGetArtifactPolicy.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    mockAxiosGet.mockResolvedValueOnce({
      data: { status: "healthy" },
    });

    const res = await request(app).get("/api/integration/health").expect(200);

    expect(res.body.status).toBe("degraded");
    expect(res.body.services.bucket.healthy).toBe(false);
    expect(res.body.services.bucket.status).toBe("unreachable");
    expect(res.body.services.bucket.error).toBe("ECONNREFUSED");
    expect(res.body.services.bucket.governance_policy_accessible).toBe(false);
    expect(res.body.services.bucket.governance_policy_error).toBe("ECONNREFUSED");
  });

  // ── PRANA healthy ──────────────────────────────────────────────────────

  it("reports PRANA healthy with B6 gap note when PRANA is reachable", async () => {
    mockCheckHealth.mockResolvedValueOnce({ healthy: true, status: "healthy" });
    mockGetArtifactPolicy.mockResolvedValueOnce({});
    mockAxiosGet.mockResolvedValueOnce({
      data: { status: "healthy", service: "bhiv-prana", forwarding_enabled: true },
    });

    const res = await request(app).get("/api/integration/health").expect(200);

    expect(res.body.services.prana.healthy).toBe(true);
    expect(res.body.services.prana.status).toBe("healthy");
    expect(res.body.services.prana.note).toContain("B6 gap");
    expect(res.body.services.prana.note).toContain("stateless");
  });

  // ── PRANA unreachable ──────────────────────────────────────────────────

  it("reports PRANA unreachable when connection fails", async () => {
    mockCheckHealth.mockResolvedValueOnce({ healthy: true, status: "healthy" });
    mockGetArtifactPolicy.mockResolvedValueOnce({});
    mockAxiosGet.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const res = await request(app).get("/api/integration/health").expect(200);

    expect(res.body.services.prana.healthy).toBe(false);
    expect(res.body.services.prana.status).toBe("unreachable");
    expect(res.body.services.prana.error).toBe("ECONNREFUSED");
  });

  // ── PRANA not configured ───────────────────────────────────────────────

  it("reports PRANA 'not_configured' when PRANA_BASE_URL is missing", async () => {
    const orig = process.env.PRANA_BASE_URL;
    delete process.env.PRANA_BASE_URL;

    mockCheckHealth.mockResolvedValueOnce({ healthy: true, status: "healthy" });
    mockGetArtifactPolicy.mockResolvedValueOnce({});

    const res = await request(app).get("/api/integration/health").expect(200);

    expect(res.body.services.prana.healthy).toBe(false);
    expect(res.body.services.prana.status).toBe("not_configured");
    expect(res.body.services.prana.reason).toContain("PRANA_BASE_URL");
    expect(res.body.env_configured.PRANA_BASE_URL).toBe(false);

    process.env.PRANA_BASE_URL = orig;
  });

  // ── KARMA routing ──────────────────────────────────────────────────────

  it("always reports KARMA as routed_via_bucket with no direct access", async () => {
    mockCheckHealth.mockResolvedValueOnce({ healthy: true, status: "healthy" });
    mockGetArtifactPolicy.mockResolvedValueOnce({});
    mockAxiosGet.mockResolvedValueOnce({ data: { status: "healthy" } });

    const res = await request(app).get("/api/integration/health").expect(200);

    expect(res.body.services.karma.routed_via_bucket).toBe(true);
    expect(res.body.services.karma.direct_access).toBe(false);
    expect(res.body.services.karma.authorized_sources).toEqual(
      expect.arrayContaining(["bucket", "core", "internal"])
    );
    expect(res.body.services.karma.note).toContain("authorization.py");
    expect(res.body.services.karma.note).toContain("bucket|core|internal");
  });

  // ── Env configured ─────────────────────────────────────────────────────

  it("reports env_configured flags accurately", async () => {
    mockCheckHealth.mockResolvedValueOnce({ healthy: true, status: "healthy" });
    mockGetArtifactPolicy.mockResolvedValueOnce({});
    mockAxiosGet.mockResolvedValueOnce({ data: { status: "healthy" } });

    const res = await request(app).get("/api/integration/health").expect(200);

    expect(res.body.env_configured.BUCKET_BASE_URL).toBe(true);
    expect(res.body.env_configured.BUCKET_API_KEY).toBe(true);
    expect(res.body.env_configured.PRANA_BASE_URL).toBe(true);
    expect(res.body.env_configured.PRANA_API_KEY).toBe(true);
    expect(res.body.env_configured.TANTRA_EXECUTION_KEY).toBe(true);
  });

  // ── Architecture notes ─────────────────────────────────────────────────

  it("includes architecture notes documenting B2, B3, B6, B7 resolutions", async () => {
    mockCheckHealth.mockResolvedValueOnce({ healthy: true, status: "healthy" });
    mockGetArtifactPolicy.mockResolvedValueOnce({});
    mockAxiosGet.mockResolvedValueOnce({ data: { status: "healthy" } });

    const res = await request(app).get("/api/integration/health").expect(200);

    const notes = res.body.architecture_notes;
    // B7: phase ordering
    expect(notes.phase_ordering).toContain("Bucket must be active before KARMA");
    // B6: PRANA gap
    expect(notes.prana_gap).toContain("stateless");
    expect(notes.prana_gap).toContain("B6");
    // B3: additive only
    expect(notes.cloudinary).toContain("additive");
    expect(notes.cloudinary).toContain("B3");
    // B2: product_context
    expect(notes.product_context).toContain("workflow");
    expect(notes.product_context).toContain("B2");
  });

  // ── Timestamp format ───────────────────────────────────────────────────

  it("returns a valid ISO 8601 timestamp", async () => {
    mockCheckHealth.mockResolvedValueOnce({ healthy: true, status: "healthy" });
    mockGetArtifactPolicy.mockResolvedValueOnce({});
    mockAxiosGet.mockResolvedValueOnce({ data: { status: "healthy" } });

    const res = await request(app).get("/api/integration/health").expect(200);

    const parsed = new Date(res.body.timestamp);
    expect(parsed.toISOString()).toBe(res.body.timestamp);
  });

  // ── Bucket governance probe ────────────────────────────────────────────

  it("probes Bucket governance policy and includes it in response", async () => {
    const mockPolicy = {
      approved_types: ["agent_outputs", "audit_trails", "event_records"],
      max_payload_bytes: 10485760,
    };
    mockCheckHealth.mockResolvedValueOnce({ healthy: true, status: "healthy" });
    mockGetArtifactPolicy.mockResolvedValueOnce(mockPolicy);
    mockAxiosGet.mockResolvedValueOnce({ data: { status: "healthy" } });

    const res = await request(app).get("/api/integration/health").expect(200);

    expect(res.body.services.bucket.governance_policy_accessible).toBe(true);
    expect(res.body.services.bucket.governance_policy).toEqual(mockPolicy);
  });

  // ── Full response body snapshot (all services healthy) ─────────────────

  it("returns a complete healthy response matching the documented shape", async () => {
    mockCheckHealth.mockResolvedValueOnce({
      healthy: true,
      status: "healthy",
      details: { status: "healthy", bucket_version: "1.0.0" },
    });
    mockGetArtifactPolicy.mockResolvedValueOnce({
      approved_types: ["agent_outputs", "audit_trails"],
    });
    mockAxiosGet.mockResolvedValueOnce({
      data: { status: "healthy", service: "bhiv-prana", forwarding_enabled: true },
    });

    const res = await request(app).get("/api/integration/health").expect(200);

    // Full snapshot validation
    expect(res.body).toEqual(
      expect.objectContaining({
        status: "healthy",
        timestamp: expect.any(String),
        services: expect.objectContaining({
          bucket: expect.objectContaining({
            healthy: true,
            status: "healthy",
            governance_policy_accessible: true,
          }),
          prana: expect.objectContaining({
            healthy: true,
            status: "healthy",
          }),
          karma: expect.objectContaining({
            routed_via_bucket: true,
            direct_access: false,
          }),
        }),
        env_configured: expect.objectContaining({
          BUCKET_BASE_URL: true,
          BUCKET_API_KEY: true,
          TANTRA_EXECUTION_KEY: true,
        }),
        architecture_notes: expect.objectContaining({
          phase_ordering: expect.any(String),
          prana_gap: expect.any(String),
          cloudinary: expect.any(String),
          product_context: expect.any(String),
        }),
      })
    );
  });

  // ── Never crashes ──────────────────────────────────────────────────────

  it("never returns a 5xx even if all probes fail", async () => {
    mockCheckHealth.mockRejectedValueOnce(new Error("total failure"));
    mockGetArtifactPolicy.mockRejectedValueOnce(new Error("total failure"));
    mockAxiosGet.mockRejectedValueOnce(new Error("total failure"));

    const res = await request(app).get("/api/integration/health").expect(200);

    expect(res.body.status).toBe("degraded");
    expect(res.body.services.bucket.healthy).toBe(false);
    expect(res.body.services.prana.healthy).toBe(false);
  });
});
