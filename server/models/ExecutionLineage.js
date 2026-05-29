const mongoose = require("mongoose");

const executionLineageSchema = new mongoose.Schema(
  {
    lineageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    executionId: {
      type: String,
      required: true,
      index: true,
    },
    traceId: {
      type: String,
      required: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    eventIndex: {
      type: Number,
      required: true,
    },
    eventTimestamp: {
      type: Date,
      required: true,
    },
    payloadSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    prevHash: {
      type: String,
    },
    hash: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

executionLineageSchema.index({ executionId: 1, eventIndex: 1 });

module.exports = mongoose.model("ExecutionLineage", executionLineageSchema);
