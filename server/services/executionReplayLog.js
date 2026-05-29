const ExecutionSession = require("../models/ExecutionSession");
const ExecutionEvent = require("../models/ExecutionEvent");
const ExecutionLineage = require("../models/ExecutionLineage");
const ExecutionRejection = require("../models/ExecutionRejection");

const getExecutionHistory = async (executionId) => {
  const session = await ExecutionSession.findOne({ executionId }).lean();
  const events = await ExecutionEvent.find({ executionId })
    .sort({ eventIndex: 1, eventTimestamp: 1 })
    .lean();
  const lineage = await ExecutionLineage.find({ executionId })
    .sort({ eventIndex: 1, eventTimestamp: 1 })
    .lean();
  const rejections = await ExecutionRejection.find({ executionId })
    .sort({ occurredAt: 1 })
    .lean();

  return { session, events, lineage, rejections };
};

module.exports = { getExecutionHistory };
