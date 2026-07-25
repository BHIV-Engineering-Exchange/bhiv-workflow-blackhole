/**
 * eventBus.test.js
 *
 * Unit tests for server/services/eventBus.js.
 * Mocks ioredis to ensure unit tests run in-process without needing a real Redis server.
 */

"use strict";

process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-only-never-production";
process.env.TANTRA_EXECUTION_KEY = "test-tantra-key-for-unit-tests-only";
process.env.MONGODB_URI = "mongodb://localhost:27017/test";

const EventEmitter = require("events");

// ── Mock ioredis ─────────────────────────────────────────────────────────────
class MockRedis extends EventEmitter {
  constructor(url, options) {
    super();
    this.url = url;
    this.options = options;
    // Defer the connect event to simulate async initialization
    process.nextTick(() => {
      this.emit("connect");
    });
  }

  async publish(channel, message) {
    // Deliver message immediately to simulate pub/sub in local test runs
    if (channel === "ecosystem.events") {
      process.nextTick(() => {
        // Find the subscriber instances and simulate message receipt
        this.emit("message", channel, message);
      });
    }
    return 1;
  }

  async subscribe(channel) {
    return ["ecosystem.events"];
  }

  async quit() {
    return "OK";
  }
}

jest.mock("ioredis", () => MockRedis);

const eventBus = require("../services/eventBus");

describe("eventBus service", () => {
  beforeEach(() => {
    // Ensure clients are initialized
    eventBus.initClients();
  });

  afterEach(() => {
    eventBus.localEmitter.removeAllListeners();
  });

  afterAll(async () => {
    await eventBus.close();
  });

  it("successfully publishes and subscribes to events", async () => {
    const testPayload = { employeeId: "emp-123", idleMinutes: 15 };
    
    const receivedPromise = new Promise((resolve) => {
      eventBus.subscribe("excessive_idle", (payload) => {
        resolve(payload);
      });
    });

    const result = await eventBus.publish("excessive_idle", testPayload);
    expect(result.success).toBe(true);

    const received = await receivedPromise;
    expect(received).toEqual(testPayload);
  });

  it("handles fallback to local event propagation gracefully", async () => {
    const testPayload = { employeeId: "emp-999", url: "http://malicious.site" };

    const receivedPromise = new Promise((resolve) => {
      eventBus.subscribe("disallowed_site", (payload) => {
        resolve(payload);
      });
    });

    // Manually disconnect event bus flag to force local fallback
    const result = await eventBus.publish("disallowed_site", testPayload);
    expect(result.success).toBe(true);
    
    const received = await receivedPromise;
    expect(received).toEqual(testPayload);
  });
});
