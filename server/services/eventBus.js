/**
 * eventBus.js
 *
 * A thin publish/subscribe wrapper using Redis as the transport.
 * Falls back to local EventEmitter if Redis is not reachable or fails.
 *
 * Part of Phase C integration work. Decouples telemetry call sites from
 * downstream karmaClient and bucketClient direct HTTP requests.
 */

"use strict";

const Redis = require("ioredis");
const EventEmitter = require("events");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CHANNEL = "ecosystem.events";

let pubClient = null;
let subClient = null;
const localEmitter = new EventEmitter();
let isRedisConnected = false;
let redisDisabled = false;

/**
 * Initialize Redis clients lazily and configure error/connect events.
 */
function initClients() {
  if (pubClient || redisDisabled) return;

  try {
    const config = {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          // Once max retries (3) are exceeded, stop reconnecting and operate quietly in localEmitter mode
          console.warn("[eventBus] Redis connection failed after 3 attempts. Operating quietly in localEmitter mode.");
          redisDisabled = true;
          setImmediate(() => {
            close();
          });
          return null; // Returning null tells ioredis to cease all reconnection attempts
        }
        return Math.min(times * 200, 1000);
      },
      enableOfflineQueue: false,
    };

    pubClient = new Redis(REDIS_URL, config);
    subClient = new Redis(REDIS_URL, config);

    pubClient.on("connect", () => {
      isRedisConnected = true;
      console.log("[eventBus] Redis Publisher connected");
    });

    pubClient.on("error", (err) => {
      isRedisConnected = false;
      if (!redisDisabled) {
        console.warn("[eventBus] Redis Publisher error:", err.message);
      }
    });

    subClient.on("connect", () => {
      console.log("[eventBus] Redis Subscriber connected");
      if (subClient) {
        subClient.subscribe(CHANNEL).catch((err) => {
          if (!redisDisabled) {
            console.error(`[eventBus] Failed to subscribe to ${CHANNEL}:`, err.message);
          }
        });
      }
    });

    subClient.on("error", (err) => {
      if (!redisDisabled) {
        console.warn("[eventBus] Redis Subscriber error:", err.message);
      }
    });

    subClient.on("message", (channel, message) => {
      if (channel === CHANNEL) {
        try {
          const envelope = JSON.parse(message);
          localEmitter.emit(envelope.type, envelope.payload);
        } catch (err) {
          console.error("[eventBus] Failed to parse Redis message:", err.message);
        }
      }
    });
  } catch (err) {
    console.error("[eventBus] Client initialization failed:", err.message);
  }
}

/**
 * Publish an event onto the event bus.
 *
 * @param {string} type - Event type identifier
 * @param {Object} payload - Event payload data
 * @returns {Promise<{success: boolean, transport: string}>}
 */
async function publish(type, payload) {
  if (!redisDisabled) {
    initClients();
  }

  const envelope = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };

  if (isRedisConnected && pubClient && !redisDisabled) {
    try {
      await pubClient.publish(CHANNEL, JSON.stringify(envelope));
      return { success: true, transport: "redis" };
    } catch (err) {
      if (!redisDisabled) {
        console.warn("[eventBus] Redis publish failed, falling back locally:", err.message);
      }
    }
  }

  // Local process delivery fallback
  localEmitter.emit(type, payload);
  return { success: true, transport: "local" };
}

/**
 * Subscribe to an event on the event bus.
 *
 * @param {string} type - Event type identifier
 * @param {Function} callback - Event listener callback function
 */
function subscribe(type, callback) {
  if (!redisDisabled) {
    initClients();
  }
  localEmitter.on(type, callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// Default ecosystem event subscribers (forwarding to clients)
// ─────────────────────────────────────────────────────────────────────────────

subscribe("excessive_idle", async (payload) => {
  try {
    const karmaClient = require("./karmaClient");
    await karmaClient.signalExcessiveIdle(payload.employeeId, payload.idleMinutes);
  } catch (err) {
    console.error("[eventBus] Handler for excessive_idle failed:", err.message);
  }
});

subscribe("disallowed_site", async (payload) => {
  try {
    const karmaClient = require("./karmaClient");
    await karmaClient.signalDisallowedSite(payload.employeeId, payload.url);
  } catch (err) {
    console.error("[eventBus] Handler for disallowed_site failed:", err.message);
  }
});

subscribe("store_screenshot", async (payload) => {
  try {
    const bucketClient = require("./bucketClient");
    await bucketClient.storeScreenshot({
      userId: payload.userId,
      sessionId: payload.sessionId,
      imageBase64: payload.imageBase64,
      metadata: payload.metadata,
      traceId: payload.traceId,
    });
  } catch (err) {
    console.error("[eventBus] Handler for store_screenshot failed:", err.message);
  }
});

async function close() {
  if (pubClient) {
    try {
      await pubClient.quit();
    } catch (_) {}
    pubClient = null;
  }
  if (subClient) {
    try {
      await subClient.quit();
    } catch (_) {}
    subClient = null;
  }
  isRedisConnected = false;
}

module.exports = {
  publish,
  subscribe,
  initClients,
  close,
  localEmitter,
};
