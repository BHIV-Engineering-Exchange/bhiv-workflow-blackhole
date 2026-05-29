const crypto = require("crypto");
const ExecutionEvent = require("../models/ExecutionEvent");
const ExecutionSession = require("../models/ExecutionSession");
const { emitLineageArtifact } = require("./executionLineageAdapter");
const { stableStringify } = require("../utils/stableStringify");
const { logRejection } = require("./executionRejectionLogger");

const EVENT_INDEX = {
  execution_started: 0,
  execution_completed: 1,
  execution_failed: 1,
  execution_blocked: 1,
};

const STATUS_BY_EVENT = {
  execution_started: "started",
  execution_completed: "completed",
  execution_failed: "failed",
  execution_blocked: "blocked",
};

const computeEventId = (executionId, traceId, eventType, eventIndex) => {
  const hash = crypto.createHash("sha256");
  hash.update(`${executionId}|${traceId}|${eventType}|${eventIndex}`);
  return hash.digest("hex");
};

const computeEventHash = (prevHash, snapshot) => {
  const hash = crypto.createHash("sha256");
  if (prevHash) {
    hash.update(prevHash);
  }
  hash.update(stableStringify(snapshot));
  return hash.digest("hex");
};

const emitLifecycleEvent = async (eventType, executionContext, payload = {}) => {
  if (!Object.prototype.hasOwnProperty.call(EVENT_INDEX, eventType)) {
    throw new Error(`Unsupported event type: ${eventType}`);
  }

  const { executionId, traceId, tenantId, contractHash, contract } = executionContext;
  const eventIndex = EVENT_INDEX[eventType];
  const eventId = computeEventId(executionId, traceId, eventType, eventIndex);

  const eventPayload = {
    ...payload,
    contract_hash: contractHash,
    execution_action: contract?.execution?.action || null,
    governance: contract?.governance || null,
  };

  const existing = await ExecutionEvent.findOne({ eventId }).lean();
  if (existing) {
    const payloadMatches =
      stableStringify(existing.payload) === stableStringify(eventPayload);

    if (
      existing.traceId !== traceId ||
      existing.executionId !== executionId ||
      existing.tenantId !== tenantId ||
      !payloadMatches
    ) {
      await logRejection({
        executionId,
        traceId,
        tenantId,
        reason: "event_payload_mismatch",
        details: {
          eventType,
          eventId,
        },
        statusCode: 409,
      });
      throw new Error("Execution event mismatch detected");
    }

    return existing;
  }

  let prevEvent = null;
  if (eventIndex > 0) {
    prevEvent = await ExecutionEvent.findOne({
      executionId,
      eventIndex: eventIndex - 1,
    }).lean();

    if (!prevEvent) {
      await logRejection({
        executionId,
        traceId,
        tenantId,
        reason: "missing_execution_start",
        details: {
          eventType,
          eventIndex,
        },
        statusCode: 409,
      });
      throw new Error("Missing execution start event");
    }
  }

  const candidateTimestamp = payload.event_timestamp
    ? new Date(payload.event_timestamp)
    : new Date();
  const eventTimestamp = Number.isNaN(candidateTimestamp.getTime())
    ? new Date()
    : candidateTimestamp;

  const snapshot = {
    eventId,
    executionId,
    traceId,
    tenantId,
    eventType,
    eventIndex,
    eventTimestamp,
    payload: eventPayload,
  };

  const prevHash = prevEvent ? prevEvent.hash : null;
  const hash = computeEventHash(prevHash, snapshot);

  let created;
  try {
    created = await ExecutionEvent.create({
      ...snapshot,
      prevHash,
      hash,
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await ExecutionEvent.findOne({ eventId }).lean();
      if (duplicate) {
        return duplicate;
      }
    }
    throw error;
  }

  await emitLineageArtifact(created);
  await ExecutionSession.updateOne(
    { executionId },
    {
      $set: {
        status: STATUS_BY_EVENT[eventType],
        lastEventType: eventType,
        lastEventAt: eventTimestamp,
      },
    }
  );

  return created;
};

module.exports = { emitLifecycleEvent };
