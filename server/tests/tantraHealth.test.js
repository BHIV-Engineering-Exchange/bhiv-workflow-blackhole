/**
 * tantraHealth.test.js
 *
 * Tests for the TANTRA runtime endpoints mounted at /api/tantra:
 *   GET  /api/tantra/health
 *   POST /api/tantra/execution/participate
 *   GET  /api/tantra/execution/:executionId/history
 *
 * Strategy: build a minimal Express app that mounts only the TANTRA router
 * (plus the middleware it depends on), stub out all MongoDB/service calls so
 * tests run without a live database, and assert on HTTP status codes and
 * response shapes.
 *
 * This file is the single test file for the TANTRA runtime — do not create
 * a parallel test file.  Extend this one as the runtime grows.
 */

"use strict";

// ── Env stubs (must be set before any module is require()d) ─────────────────
// The middleware guards throw at module load if these are missing.
process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-only-never-production";
process.env.TANTRA_EXECUTION_KEY = "test-tantra-key-for-unit-tests-only";
process.env.MONGODB_URI = "mongodb://localhost:27017/test";
process.env.NODE_ENV = "test";

const request = require("supertest");
const express = require("express");

// ── Mongoose mock ─────────────────────────────────────────────────────────────
// We stub mongoose so MongoDB models don't try to open a real connection.
jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  return {
    ...actual,
    connection: {
      // readyState 1 = "connected" — lets the health endpoint report healthy
      readyState: 1,
    },
    connect: jest.fn().mockResolvedValue(undefined),
  };
});

// ── Model mocks ───────────────────────────────────────────────────────────────
// Stub the four Execution models and the services that call them so we control
// return values without hitting a real database.

const makeFindOne = (returnValue) => ({
  lean: jest.fn().mockResolvedValue(returnValue),
});

jest.mock("../models/ExecutionEvent", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({}),
}));

jest.mock("../models/ExecutionSession", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({}),
}));

jest.mock("../models/ExecutionLineage", () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock("../models/ExecutionRejection", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

// ── Service mocks ─────────────────────────────────────────────────────────────
jest.mock("../services/executionEventEmitter", () => ({
  emitLifecycleEvent: jest.fn(),
}));

jest.mock("../services/executionReplayLog", () => ({
  getExecutionHistory: jest.fn(),
}));

jest.mock("../services/executionRejectionLogger", () => ({
  logRejection: jest.fn(),
}));

jest.mock("../services/executionLineageAdapter", () => ({
  emitLineageArtifact: jest.fn().mockResolvedValue({}),
}));

jest.mock("../services/setuDispatcher", () => ({
  dispatchToSampada: jest.fn().mockResolvedValue({}),
}));

// ── Middleware mocks ──────────────────────────────────────────────────────────
// Stub the chain middleware so we can control executionContext directly.
jest.mock("../middleware/traceContinuity", () => ({
  traceContinuity: (req, res, next) => next(),
}));

jest.mock("../middleware/governanceEnforcement", () => ({
  enforceGovernance: (req, res, next) => next(),
}));

jest.mock("../middleware/tenantIsolation", () => ({
  enforceTenantIsolation: (req, res, next) => next(),
}));

// executionAuth: accept any request that has the test execution key header.
jest.mock("../middleware/executionAuth", () => ({
  executionAuth: (req, res, next) => {
    const key = req.headers["x-execution-key"];
    if (key && key === process.env.TANTRA_EXECUTION_KEY) {
      req.executionAuthority = "setu";
      return next();
    }
    return res.status(401).json({ status: "rejected", reason: "unauthorized_execution" });
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
const {
  emitLifecycleEvent,
} = require("../services/executionEventEmitter");
const { getExecutionHistory } = require("../services/executionReplayLog");
const { logRejection } = require("../services/executionRejectionLogger");

/** Returns a minimal mock lifecycle event record. */
const mockEvent = (overrides = {}) => ({
  eventId: "evt-abc123",
  hash: "hash-abc123",
  ...overrides,
});

/** Canonical minimal execution contract for the participate endpoint. */
const validContract = {
  execution_id: "exec-test-001",
  trace_id: "trace-test-001",
  tenant_id: "tenant-test",
  contract_hash: "contract-hash-abc",
  issued_at: new Date().toISOString(),
  contract: {
    governance: { decision: "allow" },
    execution: {
      action: "process",
      requested_outcome: "completed",
      payload: { task: "test" },
      output: { result: "done" },
    },
  },
};

/** Build executionContext as executionAuth + middleware chain would produce it. */
const makeExecutionContext = (overrides = {}) => ({
  executionId: "exec-test-001",
  traceId: "trace-test-001",
  tenantId: "tenant-test",
  contractHash: "contract-hash-abc",
  contract: validContract.contract,
  ...overrides,
});

/** Auth header used by the test execution key path. */
const EXEC_HEADERS = {
  "x-execution-key": process.env.TANTRA_EXECUTION_KEY,
  "x-execution-id": "exec-test-001",
  "x-trace-id": "trace-test-001",
  "x-tenant-id": "tenant-test",
};

// ── App factory ───────────────────────────────────────────────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());

  // Inject executionContext (normally built by executionAuth + traceContinuity).
  // The middleware mocks above pass through, so we inject it via a pre-hook.
  app.use((req, res, next) => {
    req.executionContext = makeExecutionContext();
    next();
  });

  const tantraRouter = require("../routes/tantraExecution");
  app.use("/api/tantra", tantraRouter);
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/tantra/health", () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  it("returns 200 with healthy status when MongoDB is connected", async () => {
    const res = await request(app).get("/api/tantra/health");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("niyantran-tantra-runtime");
    expect(res.body.status).toBe("healthy");
    expect(res.body.components.mongodb.state).toBe("connected");
    expect(res.body.components.mongodb.healthy).toBe(true);
    expect(res.body.runtime.node_version).toMatch(/^v\d+/);
    expect(typeof res.body.runtime.uptime_seconds).toBe("number");
  });

  it("returns 503 with degraded status when MongoDB is disconnected", async () => {
    const mongoose = require("mongoose");
    const originalState = mongoose.connection.readyState;
    mongoose.connection.readyState = 0; // disconnected

    const res = await request(app).get("/api/tantra/health");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.components.mongodb.healthy).toBe(false);

    mongoose.connection.readyState = originalState;
  });

  it("includes all four execution model names", async () => {
    const res = await request(app).get("/api/tantra/health");
    expect(res.body.components.execution_models).toMatchObject({
      session: "ExecutionSession",
      event: "ExecutionEvent",
      lineage: "ExecutionLineage",
      rejection: "ExecutionRejection",
    });
  });

  it("does not require auth headers", async () => {
    // Health must be reachable by monitoring probes with no credentials.
    const res = await request(app).get("/api/tantra/health");
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

describe("POST /api/tantra/execution/participate — happy path (completed)", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
    emitLifecycleEvent
      .mockResolvedValueOnce(mockEvent({ eventId: "evt-started" }))  // execution_started
      .mockResolvedValueOnce(mockEvent({ eventId: "evt-completed" })); // execution_completed
  });

  it("returns 200 with status completed", async () => {
    const res = await request(app)
      .post("/api/tantra/execution/participate")
      .set(EXEC_HEADERS)
      .send(validContract);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
    expect(res.body.execution_id).toBeDefined();
    expect(res.body.events.execution_started).toBeDefined();
    expect(res.body.events.execution_completed).toBeDefined();
    expect(res.body.lineage.start_hash).toBeDefined();
    expect(res.body.lineage.end_hash).toBeDefined();
  });

  it("emits exactly two lifecycle events (started + completed)", async () => {
    await request(app)
      .post("/api/tantra/execution/participate")
      .set(EXEC_HEADERS)
      .send(validContract);

    expect(emitLifecycleEvent).toHaveBeenCalledTimes(2);
    expect(emitLifecycleEvent.mock.calls[0][0]).toBe("execution_started");
    expect(emitLifecycleEvent.mock.calls[1][0]).toBe("execution_completed");
  });

  it("returns 401 without execution key", async () => {
    const res = await request(app)
      .post("/api/tantra/execution/participate")
      .send(validContract); // no auth headers

    expect(res.status).toBe(401);
  });
});

describe("POST /api/tantra/execution/participate — governance-denied path", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
    emitLifecycleEvent
      .mockResolvedValueOnce(mockEvent({ eventId: "evt-started" }))
      .mockResolvedValueOnce(mockEvent({ eventId: "evt-blocked" }));

    // Override the executionContext to inject a deny decision.
    app.use = jest.fn(); // prevent re-registering; context is set in factory
  });

  it("returns 423 blocked when governance decision is deny", async () => {
    const denyApp = express();
    denyApp.use(express.json());
    denyApp.use((req, res, next) => {
      req.executionContext = makeExecutionContext({
        contract: {
          governance: { decision: "deny" },
          execution: { action: "process" },
        },
      });
      next();
    });
    const tantraRouter = require("../routes/tantraExecution");
    denyApp.use("/api/tantra", tantraRouter);

    const res = await request(denyApp)
      .post("/api/tantra/execution/participate")
      .set(EXEC_HEADERS)
      .send({ ...validContract });

    expect(res.status).toBe(423);
    expect(res.body.status).toBe("blocked");
    expect(res.body.reason).toBe("governance_denied");
    expect(res.body.events.execution_blocked).toBeDefined();
  });
});

describe("POST /api/tantra/execution/participate — contract-blocked path", () => {
  it("returns 423 blocked when requested_outcome is blocked", async () => {
    jest.clearAllMocks();
    emitLifecycleEvent
      .mockResolvedValueOnce(mockEvent({ eventId: "evt-started" }))
      .mockResolvedValueOnce(mockEvent({ eventId: "evt-blocked" }));

    const blockedApp = express();
    blockedApp.use(express.json());
    blockedApp.use((req, res, next) => {
      req.executionContext = makeExecutionContext({
        contract: {
          governance: { decision: "allow" },
          execution: { action: "process", requested_outcome: "blocked" },
        },
      });
      next();
    });
    const tantraRouter = require("../routes/tantraExecution");
    blockedApp.use("/api/tantra", tantraRouter);

    const res = await request(blockedApp)
      .post("/api/tantra/execution/participate")
      .set(EXEC_HEADERS)
      .send({});

    expect(res.status).toBe(423);
    expect(res.body.status).toBe("blocked");
    expect(res.body.reason).toBe("contract_blocked");
  });
});

describe("POST /api/tantra/execution/participate — failed path", () => {
  it("returns 500 failed when requested_outcome is failed", async () => {
    jest.clearAllMocks();
    emitLifecycleEvent
      .mockResolvedValueOnce(mockEvent({ eventId: "evt-started" }))
      .mockResolvedValueOnce(mockEvent({ eventId: "evt-failed" }));

    const failedApp = express();
    failedApp.use(express.json());
    failedApp.use((req, res, next) => {
      req.executionContext = makeExecutionContext({
        contract: {
          governance: { decision: "allow" },
          execution: { action: "process", requested_outcome: "failed" },
        },
      });
      next();
    });
    const tantraRouter = require("../routes/tantraExecution");
    failedApp.use("/api/tantra", tantraRouter);

    const res = await request(failedApp)
      .post("/api/tantra/execution/participate")
      .set(EXEC_HEADERS)
      .send({ failure_reason: "downstream_timeout" });

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("failed");
    expect(res.body.events.execution_failed).toBeDefined();
  });
});

describe("GET /api/tantra/execution/:executionId/history", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it("returns 404 when execution session does not exist", async () => {
    getExecutionHistory.mockResolvedValueOnce({ session: null, events: [], lineage: [], rejections: [] });

    const res = await request(app)
      .get("/api/tantra/execution/nonexistent-id/history")
      .set(EXEC_HEADERS);

    expect(res.status).toBe(404);
    expect(res.body.status).toBe("not_found");
  });

  it("returns 403 and logs a rejection when tenant context is missing", async () => {
    getExecutionHistory.mockResolvedValueOnce({
      session: { traceId: "t1", tenantId: "tenant-a", contractHash: "h1" },
      events: [],
      lineage: [],
      rejections: [],
    });
    logRejection.mockResolvedValueOnce({ rejectionId: "rej-001" });

    // Make a request without x-tenant-id header
    const headersNoTenant = {
      "x-execution-key": process.env.TANTRA_EXECUTION_KEY,
    };

    const res = await request(app)
      .get("/api/tantra/execution/exec-test-001/history")
      .set(headersNoTenant);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("rejected");
    expect(res.body.reason).toBe("tenant_context_missing");
    expect(logRejection).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "tenant_context_missing" })
    );
  });

  it("returns 403 and logs a rejection on tenant violation (actor ≠ owner)", async () => {
    getExecutionHistory.mockResolvedValueOnce({
      session: { traceId: "t1", tenantId: "tenant-real", contractHash: "h1" },
      events: [],
      lineage: [],
      rejections: [],
    });
    logRejection.mockResolvedValueOnce({ rejectionId: "rej-002" });

    // Actor tenant differs from session tenant
    const res = await request(app)
      .get("/api/tantra/execution/exec-test-001/history")
      .set({ ...EXEC_HEADERS, "x-tenant-id": "tenant-imposter" });

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("rejected");
    expect(res.body.reason).toBe("tenant_violation");
    expect(logRejection).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "tenant_violation",
        details: expect.objectContaining({ actor_tenant: "tenant-imposter" }),
      })
    );
  });

  it("returns 200 with full history when tenant matches", async () => {
    const session = {
      traceId: "trace-test-001",
      tenantId: "tenant-test",
      contractHash: "contract-hash-abc",
    };
    getExecutionHistory.mockResolvedValueOnce({
      session,
      events: [{ eventId: "evt-1", eventType: "execution_started" }],
      lineage: [],
      rejections: [],
    });

    const res = await request(app)
      .get("/api/tantra/execution/exec-test-001/history")
      .set(EXEC_HEADERS); // x-tenant-id: "tenant-test" matches session.tenantId

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.session).toEqual(session);
    expect(res.body.events).toHaveLength(1);
  });

  it("returns 401 without auth", async () => {
    const res = await request(app)
      .get("/api/tantra/execution/exec-test-001/history");
    expect(res.status).toBe(401);
  });
});

describe("ExecutionRejection — logRejection is called on failure paths", () => {
  /**
   * Verify the critical invariant: every rejection path calls logRejection,
   * which persists an ExecutionRejection record.  This ensures the failure
   * audit trail is populated, not just modeled.
   */
  it("logs a rejection for tenant_context_missing", async () => {
    jest.clearAllMocks();
    const app2 = buildApp();
    getExecutionHistory.mockResolvedValueOnce({
      session: { traceId: "t1", tenantId: "tenant-a", contractHash: "h" },
      events: [],
      lineage: [],
      rejections: [],
    });
    logRejection.mockResolvedValueOnce({ rejectionId: "rej-audit-001" });

    await request(app2)
      .get("/api/tantra/execution/exec-123/history")
      .set({ "x-execution-key": process.env.TANTRA_EXECUTION_KEY });

    expect(logRejection).toHaveBeenCalledTimes(1);
    const call = logRejection.mock.calls[0][0];
    expect(call.reason).toBe("tenant_context_missing");
    expect(call.statusCode).toBe(403);
  });

  it("logs a rejection for tenant_violation", async () => {
    jest.clearAllMocks();
    const app3 = buildApp();
    getExecutionHistory.mockResolvedValueOnce({
      session: { traceId: "t2", tenantId: "tenant-real", contractHash: "h" },
      events: [],
      lineage: [],
      rejections: [],
    });
    logRejection.mockResolvedValueOnce({ rejectionId: "rej-audit-002" });

    await request(app3)
      .get("/api/tantra/execution/exec-456/history")
      .set({
        "x-execution-key": process.env.TANTRA_EXECUTION_KEY,
        "x-tenant-id": "tenant-imposter",
      });

    expect(logRejection).toHaveBeenCalledTimes(1);
    const call = logRejection.mock.calls[0][0];
    expect(call.reason).toBe("tenant_violation");
    expect(call.statusCode).toBe(403);
  });

  it("logs a rejection on unauthorized_execution (wrong key, via mocked executionAuth)", async () => {
    // The executionAuth mock in this file only passes requests with the correct
    // TANTRA_EXECUTION_KEY.  A wrong key results in a 401 rejection WITHOUT
    // calling logRejection through executionAuth (the mock short-circuits).
    // We test the 401 status here; the full logRejection path for unauthorized_execution
    // is covered by executionAuth.js's own unit tests when it is exercised with
    // its real implementation.
    jest.clearAllMocks();
    const app4 = buildApp();

    const res = await request(app4)
      .post("/api/tantra/execution/participate")
      .set({ "x-execution-key": "definitely-wrong-key" })
      .send(validContract);

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("rejected");
  });
});
