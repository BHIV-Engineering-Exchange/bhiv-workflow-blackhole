const mongoose = require("mongoose");

const executionRejectionSchema = new mongoose.Schema(
  {
    rejectionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    executionId: {
      type: String,
      default: null,
      index: true,
    },
    traceId: {
      type: String,
      default: null,
      index: true,
    },
    tenantId: {
      type: String,
      default: null,
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    statusCode: {
      type: Number,
      default: 403,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model("ExecutionRejection", executionRejectionSchema);
