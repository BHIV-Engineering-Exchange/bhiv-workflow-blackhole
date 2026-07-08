const express = require("express");
const router = express.Router();
const ExecutionEvent = require("../models/ExecutionEvent");
const ExecutionSession = require("../models/ExecutionSession");
const Task = require("../models/Task");
const TaskSubmission = require("../models/TaskSubmission");
const { executionAuth } = require("../middleware/executionAuth");
const { generateExecutionId } = require("../services/taskExecutionBridge");

// Get task execution state
router.get("/task/:taskId/state", executionAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId).select("assignee status branch createdAt updatedAt");

    if (!task) {
      return res.status(404).json({
        status: "not_found",
        message: "Task not found"
      });
    }

    const executionId = generateExecutionId(taskId, task.assignee);
    const session = await ExecutionSession.findOne({ executionId }).lean();

    if (!session) {
      return res.json({
        task_id: taskId,
        state: "uninitialized",
        trace_id: null,
        timestamp: task.createdAt,
        tenant_id: task.branch
      });
    }

    const events = await ExecutionEvent.find({ executionId })
      .sort({ eventIndex: 1 })
      .lean();

    const lastEvent = events[events.length - 1];

    return res.json({
      task_id: taskId,
      execution_id: executionId,
      state: session.status,
      trace_id: session.traceId,
      timestamp: lastEvent?.eventTimestamp || session.receivedAt,
      tenant_id: session.tenantId,
      events: events.map(e => ({
        event_type: e.eventType,
        event_index: e.eventIndex,
        timestamp: e.eventTimestamp
      }))
    });
  } catch (error) {
    console.error("Error fetching task state:", error);
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// Get submission execution state
router.get("/submission/:submissionId/state", executionAuth, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const submission = await TaskSubmission.findById(submissionId)
      .select("task user status createdAt updatedAt")
      .lean();

    if (!submission) {
      return res.status(404).json({
        status: "not_found",
        message: "Submission not found"
      });
    }

    const executionId = generateExecutionId(submission.task, submission.user);
    const events = await ExecutionEvent.find({ executionId })
      .sort({ eventIndex: 1 })
      .lean();

    const submissionEvent = events.find(e => 
      e.payload?.event_type === "TASK_SUBMITTED" && 
      e.payload?.submission_id === submissionId
    );

    if (!submissionEvent) {
      return res.json({
        submission_id: submissionId,
        state: "pending",
        trace_id: null,
        timestamp: submission.createdAt,
        tenant_id: null
      });
    }

    return res.json({
      submission_id: submissionId,
      execution_id: executionId,
      state: submission.status.toLowerCase(),
      trace_id: submissionEvent.traceId,
      timestamp: submissionEvent.eventTimestamp,
      tenant_id: submissionEvent.tenantId,
      event_type: submissionEvent.payload?.event_type
    });
  } catch (error) {
    console.error("Error fetching submission state:", error);
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// Get execution status by trace_id
router.get("/trace/:traceId/status", executionAuth, async (req, res) => {
  try {
    const { traceId } = req.params;
    
    const events = await ExecutionEvent.find({ traceId })
      .sort({ eventTimestamp: 1 })
      .lean();

    if (events.length === 0) {
      return res.status(404).json({
        status: "not_found",
        trace_id: traceId
      });
    }

    const session = await ExecutionSession.findOne({ 
      executionId: events[0].executionId 
    }).lean();

    const timeline = events.map(e => ({
      event_type: e.eventType,
      entity_id: e.payload?.entity_id,
      timestamp: e.eventTimestamp,
      event_index: e.eventIndex
    }));

    return res.json({
      trace_id: traceId,
      execution_id: events[0].executionId,
      state: session?.status || "unknown",
      tenant_id: events[0].tenantId,
      timestamp: events[events.length - 1].eventTimestamp,
      timeline
    });
  } catch (error) {
    console.error("Error fetching trace status:", error);
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// Get all execution events for a tenant
router.get("/tenant/:tenantId/events", executionAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { limit = 100, eventType } = req.query;

    const filter = { tenantId };
    if (eventType) {
      filter.eventType = eventType;
    }

    const events = await ExecutionEvent.find(filter)
      .sort({ eventTimestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    return res.json({
      tenant_id: tenantId,
      count: events.length,
      events: events.map(e => ({
        execution_id: e.executionId,
        trace_id: e.traceId,
        event_type: e.eventType,
        entity_id: e.payload?.entity_id,
        timestamp: e.eventTimestamp
      }))
    });
  } catch (error) {
    console.error("Error fetching tenant events:", error);
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

module.exports = router;
