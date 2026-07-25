const mongoose = require("mongoose");

const executionSessionSchema = new mongoose.Schema(
  {
    executionId: {
      type: String,
      required: true,
      unique: true,
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
    contractHash: {
      type: String,
      required: true,
    },
    contractVersion: {
      type: String,
    },
    contract: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    governance: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    issuedAt: {
      type: Date,
      required: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["started", "completed", "failed", "blocked"],
      default: "started",
    },
    actorId: {
      type: String,
      default: null,
      index: true,
    },
    actorType: {
      type: String,
      enum: ["user", "authority", null],
      default: null,
    },
    lastEventType: {
      type: String,
    },
    lastEventAt: {
      type: Date,
    },
  },
  { timestamps: false }
);

executionSessionSchema.index({ tenantId: 1, executionId: 1 });

module.exports = mongoose.model("ExecutionSession", executionSessionSchema);
