/**
 * bucketClient.test.js
 *
 * Unit tests for server/services/bucketClient.js.
 * Tests run entirely in-process — no network calls, no Bucket instance required.
 * Axios is mocked at the module level.
 */

"use strict";

process.env.BUCKET_BASE_URL = "http://test-bucket:8001";
process.env.BUCKET_API_KEY = "test-bucket-api-key";
process.env.BUCKET_TIMEOUT_MS = "5000";
// These must also be set because auth.js guard fires on first require
process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-only";
process.env.TANTRA_EXECUTION_KEY = "test-tantra-key-for-unit-tests-only";
process.env.MONGODB_URI = "mongodb://localhost:27017/test";

// ── Mock axios ────────────────────────────────────────────────────────────────
const mockAxiosGet = jest.fn();
const mockAxiosPost = jest.fn();
const mockAxiosCreate = jest.fn(() => ({
  get: mockAxiosGet,
  post: mockAxiosPost,
}));

jest.mock("axios", () => ({
  create: mockAxiosCreate,
}));

// ── Subject under test ────────────────────────────────────────────────────────
const {
  writeArtifact,
  storeScreenshot,
  storeExport,
  storeKarmaEventRecord,
  validateArtifactAdmission,
  checkHealth,
  buildArtifactEnvelope,
  ARTIFACT_TYPES,
  NIYANTRAN_INTEGRATION_ID,
  NIYANTRAN_REQUESTER_ID,
} = require("../services/bucketClient");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical successful governance gate response */
const ADMISSION_OK = { data: { allowed: true, message: "Operation validated" } };

/** Canonical successful Bucket write response */
const WRITE_OK = {
  data: {
    success: true,
    request_id: "req-001",
    timestamp: new Date().toISOString(),
    data: {
      artifact_id: "art-001",
      hash: "sha256-hash-abc",
      parent_hash: null,
      timestamp_utc: new Date().toISOString(),
      storage_type: "append_only",
      deterministic: true,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// buildArtifactEnvelope
// ─────────────────────────────────────────────────────────────────────────────

describe("buildArtifactEnvelope", () => {
  it("produces a complete envelope with all required fields", () => {
    const env = buildArtifactEnvelope({
      artifactType: ARTIFACT_TYPES.SCREENSHOT,
      traceId: "trace-001",
      payload: { image_base64: "abc" },
    });
    expect(env.artifact_id).toBeDefined();
    expect(env.trace_id).toBe("trace-001");
    expect(env.timestamp_utc).toBeDefined();
    expect(env.schema_version).toBe("1.0.0");
    expect(env.source_module_id).toBe(NIYANTRAN_REQUESTER_ID);
    expect(env.artifact_type).toBe(ARTIFACT_TYPES.SCREENSHOT);
    expect(env.parent_hash).toBeNull();
    expect(env.payload).toEqual({ image_base64: "abc" });
  });

  it("does NOT include a hash field (Bucket computes it server-side)", () => {
    const env = buildArtifactEnvelope({
      artifactType: ARTIFACT_TYPES.SCREENSHOT,
      traceId: "trace-002",
      payload: {},
    });
    expect(env.hash).toBeUndefined();
  });

  it("accepts and passes through parentHash", () => {
    const env = buildArtifactEnvelope({
      artifactType: ARTIFACT_TYPES.EXPORT,
      traceId: "trace-003",
      payload: {},
      parentHash: "parent-hash-xyz",
    });
    expect(env.parent_hash).toBe("parent-hash-xyz");
  });

  it("generates a traceId if none provided", () => {
    const env = buildArtifactEnvelope({ artifactType: ARTIFACT_TYPES.EXPORT, payload: {} });
    expect(typeof env.trace_id).toBe("string");
    expect(env.trace_id.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateArtifactAdmission
// ─────────────────────────────────────────────────────────────────────────────

describe("validateArtifactAdmission", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns valid: true when governance gate approves", async () => {
    mockAxiosPost.mockResolvedValueOnce(ADMISSION_OK);
    const result = await validateArtifactAdmission(ARTIFACT_TYPES.SCREENSHOT, 1024);
    expect(result.valid).toBe(true);
  });

  it("returns valid: false when governance gate returns 403", async () => {
    mockAxiosPost.mockRejectedValueOnce({
      response: { status: 403, data: { detail: { reason: "size_limit_exceeded" } } },
    });
    const result = await validateArtifactAdmission(ARTIFACT_TYPES.SCREENSHOT, 99999999);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("size_limit_exceeded");
  });

  it("throws on non-403 errors (network failure etc.)", async () => {
    mockAxiosPost.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(
      validateArtifactAdmission(ARTIFACT_TYPES.SCREENSHOT, 1024)
    ).rejects.toThrow("ECONNREFUSED");
  });

  it("posts to the correct governance endpoint", async () => {
    mockAxiosPost.mockResolvedValueOnce(ADMISSION_OK);
    await validateArtifactAdmission(ARTIFACT_TYPES.EXPORT, 2048);
    expect(mockAxiosPost).toHaveBeenCalledWith(
      "/governance/gate/validate-operation",
      null,
      expect.objectContaining({
        params: expect.objectContaining({
          operation_type: "CREATE",
          artifact_class: ARTIFACT_TYPES.EXPORT,
          data_size: 2048,
          integration_id: NIYANTRAN_INTEGRATION_ID,
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// writeArtifact
// ─────────────────────────────────────────────────────────────────────────────

describe("writeArtifact", () => {
  beforeEach(() => jest.clearAllMocks());

  it("validates admission before writing (calls validate-operation first)", async () => {
    mockAxiosPost
      .mockResolvedValueOnce(ADMISSION_OK)  // governance gate
      .mockResolvedValueOnce(WRITE_OK);      // /bucket/artifacts/write

    await writeArtifact({
      artifactType: ARTIFACT_TYPES.SCREENSHOT,
      traceId: "trace-w1",
      payload: { data: "test" },
    });

    expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    expect(mockAxiosPost.mock.calls[0][0]).toBe("/governance/gate/validate-operation");
    expect(mockAxiosPost.mock.calls[1][0]).toBe("/bucket/artifacts/write");
  });

  it("rejects without writing if governance gate denies", async () => {
    mockAxiosPost.mockRejectedValueOnce({
      response: { status: 403, data: { detail: { reason: "class_not_allowed" } } },
    });

    await expect(
      writeArtifact({ artifactType: ARTIFACT_TYPES.SCREENSHOT, traceId: "t1", payload: {} })
    ).rejects.toThrow(/BUCKET_ADMISSION_REJECTED|Artifact admission rejected/);

    // Must not have attempted the write
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });

  it("returns the Bucket data on success", async () => {
    mockAxiosPost
      .mockResolvedValueOnce(ADMISSION_OK)
      .mockResolvedValueOnce(WRITE_OK);

    const result = await writeArtifact({
      artifactType: ARTIFACT_TYPES.EXPORT,
      traceId: "trace-w2",
      payload: { test: true },
    });

    expect(result.artifact_id).toBe("art-001");
    expect(result.hash).toBe("sha256-hash-abc");
    expect(result.storage_type).toBe("append_only");
  });

  it("throws BUCKET_WRITE_FAILED when Bucket returns success: false", async () => {
    mockAxiosPost
      .mockResolvedValueOnce(ADMISSION_OK)
      .mockResolvedValueOnce({
        data: { success: false, error: "schema_validation_failed", request_id: "req-err" },
      });

    await expect(
      writeArtifact({ artifactType: ARTIFACT_TYPES.EXPORT, traceId: "t2", payload: {} })
    ).rejects.toThrow(/BUCKET_WRITE_FAILED|Bucket write failed/);
  });

  it("posts the correct contract envelope to /bucket/artifacts/write", async () => {
    mockAxiosPost
      .mockResolvedValueOnce(ADMISSION_OK)
      .mockResolvedValueOnce(WRITE_OK);

    await writeArtifact({
      artifactType: ARTIFACT_TYPES.AUDIT_TRAIL,
      traceId: "trace-w3",
      payload: { action: "login", actor: "user-1" },
    });

    const writeCall = mockAxiosPost.mock.calls[1];
    expect(writeCall[0]).toBe("/bucket/artifacts/write");
    const body = writeCall[1];
    expect(body.requester_id).toBe(NIYANTRAN_REQUESTER_ID);
    expect(body.integration_id).toBe(NIYANTRAN_INTEGRATION_ID);
    expect(body.artifact.artifact_type).toBe(ARTIFACT_TYPES.AUDIT_TRAIL);
    expect(body.artifact.trace_id).toBe("trace-w3");
    expect(body.artifact.payload.action).toBe("login");
    expect(body.artifact.hash).toBeUndefined(); // Bucket computes hash
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// storeScreenshot
// ─────────────────────────────────────────────────────────────────────────────

describe("storeScreenshot", () => {
  beforeEach(() => jest.clearAllMocks());

  it("writes an agent_outputs artifact with correct payload fields", async () => {
    mockAxiosPost
      .mockResolvedValueOnce(ADMISSION_OK)
      .mockResolvedValueOnce(WRITE_OK);

    await storeScreenshot({
      userId: "user-123",
      sessionId: "sess-456",
      imageBase64: "base64data",
      metadata: { width: 1920, height: 1080 },
      traceId: "trace-ss",
    });

    const writeBody = mockAxiosPost.mock.calls[1][1];
    expect(writeBody.artifact.artifact_type).toBe(ARTIFACT_TYPES.SCREENSHOT);
    expect(writeBody.artifact.payload.user_id).toBe("user-123");
    expect(writeBody.artifact.payload.session_id).toBe("sess-456");
    expect(writeBody.artifact.payload.image_base64).toBe("base64data");
    expect(writeBody.artifact.payload.metadata).toEqual({ width: 1920, height: 1080 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// storeExport
// ─────────────────────────────────────────────────────────────────────────────

describe("storeExport", () => {
  beforeEach(() => jest.clearAllMocks());

  it("writes an agent_outputs artifact with export payload fields", async () => {
    mockAxiosPost
      .mockResolvedValueOnce(ADMISSION_OK)
      .mockResolvedValueOnce(WRITE_OK);

    await storeExport({
      exportType: "salary_report",
      generatedBy: "admin-001",
      data: { month: "June", total: 50000 },
      traceId: "trace-exp",
    });

    const writeBody = mockAxiosPost.mock.calls[1][1];
    expect(writeBody.artifact.payload.export_type).toBe("salary_report");
    expect(writeBody.artifact.payload.generated_by).toBe("admin-001");
    expect(writeBody.artifact.payload.data.month).toBe("June");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// storeKarmaEventRecord
// ─────────────────────────────────────────────────────────────────────────────

describe("storeKarmaEventRecord", () => {
  beforeEach(() => jest.clearAllMocks());

  it("writes an event_records artifact with canonical KARMA contract fields", async () => {
    mockAxiosPost
      .mockResolvedValueOnce(ADMISSION_OK)
      .mockResolvedValueOnce(WRITE_OK);

    await storeKarmaEventRecord({
      subjectId: "user-789",
      signal: "nudge",
      severity: 0.6,
      ttl: 300,
      opaqueReasonCode: "NIY_MON_001",
      traceId: "trace-karma",
    });

    const writeBody = mockAxiosPost.mock.calls[1][1];
    const payload = writeBody.artifact.payload;
    expect(writeBody.artifact.artifact_type).toBe(ARTIFACT_TYPES.EVENT_RECORD);
    expect(payload.subject_id).toBe("user-789");
    expect(payload.product_context).toBe("workflow");
    expect(payload.signal).toBe("nudge");
    expect(payload.severity).toBe(0.6);
    expect(payload.ttl).toBe(300);
    expect(payload.requires_core_ack).toBe(true);
    expect(payload.opaque_reason_code).toBe("NIY_MON_001");
  });

  it("rejects invalid signal values", async () => {
    await expect(
      storeKarmaEventRecord({
        subjectId: "user-1",
        signal: "approve",  // not a valid KARMA signal
        severity: 0.5,
        ttl: 300,
        opaqueReasonCode: "NIY_NRM_001",
      })
    ).rejects.toThrow(/Invalid signal value/);
  });

  it("rejects severity out of range", async () => {
    await expect(
      storeKarmaEventRecord({
        subjectId: "user-1",
        signal: "allow",
        severity: 1.5,   // out of range
        ttl: 300,
        opaqueReasonCode: "NIY_NRM_001",
      })
    ).rejects.toThrow(/Invalid severity/);
  });

  it("rejects ttl < 1", async () => {
    await expect(
      storeKarmaEventRecord({
        subjectId: "user-1",
        signal: "allow",
        severity: 0.0,
        ttl: 0,   // invalid
        opaqueReasonCode: "NIY_NRM_001",
      })
    ).rejects.toThrow(/Invalid ttl/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// checkHealth
// ─────────────────────────────────────────────────────────────────────────────

describe("checkHealth", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns healthy: true when Bucket reports healthy", async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { status: "healthy", bucket_version: "1.0.0" } });
    const result = await checkHealth();
    expect(result.healthy).toBe(true);
    expect(result.status).toBe("healthy");
  });

  it("returns healthy: true for degraded status (still reachable)", async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { status: "degraded" } });
    const result = await checkHealth();
    expect(result.healthy).toBe(true);
    expect(result.status).toBe("degraded");
  });

  it("returns healthy: false when Bucket is unreachable", async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await checkHealth();
    expect(result.healthy).toBe(false);
    expect(result.status).toBe("unreachable");
    expect(result.error).toBe("ECONNREFUSED");
  });

  it("calls GET /health on the Bucket service", async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { status: "healthy" } });
    await checkHealth();
    expect(mockAxiosGet).toHaveBeenCalledWith("/health");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Missing env var behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe("Missing env var behaviour", () => {
  it("returns healthy: false with a descriptive error if BUCKET_BASE_URL is missing", async () => {
    const orig = process.env.BUCKET_BASE_URL;
    delete process.env.BUCKET_BASE_URL;
    jest.resetModules();

    // Re-set required vars so auth guards don't fire
    process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-only";
    process.env.TANTRA_EXECUTION_KEY = "test-tantra-key-for-unit-tests-only";
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
    process.env.BUCKET_API_KEY = "test-bucket-api-key";

    jest.mock("axios", () => ({ create: jest.fn(() => ({ get: jest.fn(), post: jest.fn() })) }));
    const freshClient = require("../services/bucketClient");

    // checkHealth() never throws — it catches and returns { healthy: false }
    const result = await freshClient.checkHealth();
    expect(result.healthy).toBe(false);
    expect(result.status).toBe("unreachable");
    expect(result.error).toMatch(/BUCKET_BASE_URL/);
    process.env.BUCKET_BASE_URL = orig;
  });
});
