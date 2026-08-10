const { emitLifecycleEvent } = require("./executionEventEmitter");
const crypto = require("crypto");

const generateExecutionId = (taskId, userId) => {
  const hash = crypto.createHash("sha256");
  const tId = taskId && taskId._id ? taskId._id.toString() : taskId.toString();
  const uId = userId && userId._id ? userId._id.toString() : userId.toString();
  hash.update(`task:${tId}:user:${uId}`);
  return `exec_${hash.digest("hex").substring(0, 16)}`;
};

const emitTaskAssignedEvent = async (task, traceId, tenantId) => {
  const executionId = generateExecutionId(task._id, task.assignee);
  
  const executionContext = {
    executionId,
    traceId: traceId || `trace_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
    tenantId: tenantId || task.branch || "blackhole_mumbai",
    contractHash: crypto.createHash("sha256").update(`task:${task._id}`).digest("hex"),
    contract: {
      execution: { action: "task_assigned", entity_id: task._id.toString() },
      governance: { decision: "allow" }
    }
  };

  console.log(`[TRACE_EMITTED] Task assigned - trace_id=${executionContext.traceId}, entity_id=${task._id}`);

  await emitLifecycleEvent("execution_started", executionContext, {
    event_type: "TASK_ASSIGNED",
    entity_id: task._id.toString(),
    entity_type: "task",
    assignee: task.assignee.toString(),
    task_title: task.title,
    event_timestamp: new Date()
  });

  return executionContext;
};

const emitTaskSubmittedEvent = async (submission, traceId, tenantId) => {
  const executionId = generateExecutionId(submission.task, submission.user);

  if (!traceId) {
    console.error(`[TRACE_FAILURE] Missing trace_id for submission ${submission._id}`);
    throw new Error("trace_id required for submission");
  }

  const executionContext = {
    executionId,
    traceId,
    tenantId: tenantId || "blackhole_mumbai",
    contractHash: crypto.createHash("sha256").update(`submission:${submission._id}`).digest("hex"),
    contract: {
      execution: { action: "task_submitted", entity_id: submission.task.toString() },
      governance: { decision: "allow" }
    }
  };

  console.log(`[TRACE_RECEIVED] Submission received - trace_id=${traceId}`);
  console.log(`[TRACE_EMITTED] Task submitted - trace_id=${traceId}, entity_id=${submission.task}`);

  await emitLifecycleEvent("execution_completed", executionContext, {
    event_type: "TASK_SUBMITTED",
    entity_id: submission.task.toString(),
    entity_type: "submission",
    submission_id: submission._id.toString(),
    user_id: submission.user.toString(),
    event_timestamp: new Date()
  });

  return executionContext;
};

const emitTaskCompletedEvent = async (submission, traceId, tenantId) => {
  const executionId = generateExecutionId(submission.task, submission.user);

  if (!traceId) {
    console.error(`[TRACE_FAILURE] Missing trace_id for completion ${submission._id}`);
    throw new Error("trace_id required for completion");
  }

  const executionContext = {
    executionId,
    traceId,
    tenantId: tenantId || "blackhole_mumbai",
    contractHash: crypto.createHash("sha256").update(`approval:${submission._id}`).digest("hex"),
    contract: {
      execution: { action: "task_completed", entity_id: submission.task.toString() },
      governance: { decision: "allow" }
    }
  };

  console.log(`[TRACE_RECEIVED] Approval received - trace_id=${traceId}`);
  console.log(`[TRACE_EMITTED] Task completed - trace_id=${traceId}, entity_id=${submission.task}`);

  await emitLifecycleEvent("execution_completed", executionContext, {
    event_type: "TASK_COMPLETED",
    entity_id: submission.task.toString(),
    entity_type: "submission",
    submission_id: submission._id.toString(),
    status: submission.status,
    event_timestamp: new Date()
  });

  return executionContext;
};

const emitTaskFailedEvent = async (submission, reason, traceId, tenantId) => {
  const executionId = generateExecutionId(submission.task, submission.user);

  if (!traceId) {
    console.error(`[TRACE_FAILURE] Missing trace_id for failure ${submission._id}`);
    throw new Error("trace_id required for failure");
  }

  const executionContext = {
    executionId,
    traceId,
    tenantId: tenantId || "blackhole_mumbai",
    contractHash: crypto.createHash("sha256").update(`rejection:${submission._id}`).digest("hex"),
    contract: {
      execution: { action: "task_failed", entity_id: submission.task.toString() },
      governance: { decision: "allow" }
    }
  };

  console.log(`[TRACE_RECEIVED] Rejection received - trace_id=${traceId}`);
  console.log(`[TRACE_EMITTED] Task failed - trace_id=${traceId}, entity_id=${submission.task}, reason=${reason}`);

  await emitLifecycleEvent("execution_failed", executionContext, {
    event_type: "TASK_FAILED",
    entity_id: submission.task.toString(),
    entity_type: "submission",
    submission_id: submission._id.toString(),
    reason,
    event_timestamp: new Date()
  });

  return executionContext;
};

module.exports = {
  emitTaskAssignedEvent,
  emitTaskSubmittedEvent,
  emitTaskCompletedEvent,
  emitTaskFailedEvent,
  generateExecutionId
};
