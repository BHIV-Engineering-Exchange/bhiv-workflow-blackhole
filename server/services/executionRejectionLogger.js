const crypto = require("crypto");
const ExecutionRejection = require("../models/ExecutionRejection");
const { stableStringify } = require("../utils/stableStringify");

const computeRejectionId = (payload) => {
  const hash = crypto.createHash("sha256");
  hash.update(stableStringify(payload));
  return hash.digest("hex");
};

const logRejection = async ({
  executionId,
  traceId,
  tenantId,
  reason,
  details,
  statusCode,
}) => {
  const payload = {
    executionId: executionId || null,
    traceId: traceId || null,
    tenantId: tenantId || null,
    reason,
    details: details || {},
  };

  const rejectionId = computeRejectionId(payload);

  const existing = await ExecutionRejection.findOne({ rejectionId }).lean();
  if (existing) {
    return existing;
  }

  const record = await ExecutionRejection.create({
    rejectionId,
    ...payload,
    statusCode: statusCode || 403,
    occurredAt: new Date(),
  });

  console.warn("Execution rejected:", reason, {
    executionId: executionId || null,
    traceId: traceId || null,
    tenantId: tenantId || null,
  });

  return record;
};

module.exports = { logRejection };
