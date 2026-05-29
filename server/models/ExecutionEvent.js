const mongoose = require("mongoose");

const executionEventSchema = new mongoose.Schema(
  {
    eventId: {
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
    eventType: {
      type: String,
      required: true,
      enum: [
        "execution_started",
        "execution_completed",
        "execution_failed",
        "execution_blocked",
      ],
      index: true,
    },
    eventIndex: {
      type: Number,
      required: true,
      index: true,
    },
    eventTimestamp: {
      type: Date,
      required: true,
    },
    payload: {
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
  },
  { timestamps: false }
);

executionEventSchema.index({ executionId: 1, eventIndex: 1 });

module.exports = mongoose.model("ExecutionEvent", executionEventSchema);
