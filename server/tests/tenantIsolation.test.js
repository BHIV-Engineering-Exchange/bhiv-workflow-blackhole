/**
 * tenantIsolation.test.js
 *
 * Unit tests for tenantIsolation middleware and actor identity persistence (Phase E).
 */

"use strict";

process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-only-never-production";
process.env.TANTRA_EXECUTION_KEY = "test-tantra-key-for-unit-tests-only";
process.env.MONGODB_URI = "mongodb://localhost:27017/test";

const { enforceTenantIsolation } = require("../middleware/tenantIsolation");
const ExecutionSession = require("../models/ExecutionSession");

// Mock ExecutionSession and rejection logger
jest.mock("../models/ExecutionSession", () => ({
  updateOne: jest.fn().mockResolvedValue({ nModified: 1 }),
}));

jest.mock("../services/executionRejectionLogger", () => ({
  logRejection: jest.fn().mockResolvedValue({ rejectionId: "mock-rej-id" }),
}));

describe("tenantIsolation middleware", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it("persists user actor details when req.user is set", async () => {
    req = {
      headers: {
        "x-tenant-id": "tenant-abc",
      },
      user: {
        id: "usr-123",
        branch: "tenant-abc",
      },
      executionContext: {
        executionId: "exec-100",
        tenantId: "tenant-abc",
        session: {},
      },
    };

    await enforceTenantIsolation(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(ExecutionSession.updateOne).toHaveBeenCalledWith(
      { executionId: "exec-100" },
      { $set: { actorId: "usr-123", actorType: "user" } }
    );
    expect(req.executionContext.session.actorId).toBe("usr-123");
    expect(req.executionContext.session.actorType).toBe("user");
  });

  it("persists execution authority when req.executionAuthority is set", async () => {
    req = {
      headers: {
        "x-tenant-id": "tenant-abc",
      },
      executionAuthority: "setu",
      executionContext: {
        executionId: "exec-200",
        tenantId: "tenant-abc",
        session: {},
      },
    };

    await enforceTenantIsolation(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(ExecutionSession.updateOne).toHaveBeenCalledWith(
      { executionId: "exec-200" },
      { $set: { actorId: "setu", actorType: "authority" } }
    );
    expect(req.executionContext.session.actorId).toBe("setu");
    expect(req.executionContext.session.actorType).toBe("authority");
  });

  it("rejects with 403 on tenant mismatch", async () => {
    req = {
      headers: {
        "x-tenant-id": "tenant-hacker",
      },
      user: {
        id: "usr-123",
        branch: "tenant-hacker",
      },
      executionContext: {
        executionId: "exec-300",
        tenantId: "tenant-real",
        session: {},
      },
    };

    await enforceTenantIsolation(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "tenant_violation" })
    );
  });
});
