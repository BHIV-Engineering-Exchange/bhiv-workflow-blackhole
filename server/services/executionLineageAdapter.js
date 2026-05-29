const crypto = require("crypto");
const ExecutionLineage = require("../models/ExecutionLineage");
const { stableStringify } = require("../utils/stableStringify");

const computeLineageHash = (prevHash, artifact) => {
  const hash = crypto.createHash("sha256");
  if (prevHash) {
    hash.update(prevHash);
  }
  hash.update(stableStringify(artifact));
  return hash.digest("hex");
};

const emitLineageArtifact = async (event) => {
  const lineageId = event.eventId;

  const existing = await ExecutionLineage.findOne({ lineageId }).lean();
  if (existing) {
    return existing;
  }

  let prevArtifact = null;
  if (event.eventIndex > 0) {
    prevArtifact = await ExecutionLineage.findOne({
      executionId: event.executionId,
      eventIndex: event.eventIndex - 1,
    }).lean();
  }

  if (event.eventIndex > 0 && !prevArtifact) {
    throw new Error("Missing previous lineage artifact");
  }

  const artifact = {
    lineageId,
    executionId: event.executionId,
    traceId: event.traceId,
    tenantId: event.tenantId,
    eventId: event.eventId,
    eventType: event.eventType,
    eventIndex: event.eventIndex,
    eventTimestamp: event.eventTimestamp,
    payloadSnapshot: event.payload,
    prevHash: prevArtifact ? prevArtifact.hash : null,
  };

  const hash = computeLineageHash(artifact.prevHash, artifact);

  return ExecutionLineage.create({
    ...artifact,
    hash,
    createdAt: new Date(),
  });
};

module.exports = { emitLineageArtifact, computeLineageHash };
