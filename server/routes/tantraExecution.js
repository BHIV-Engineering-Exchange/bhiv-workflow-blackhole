const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const { executionAuth } = require("../middleware/executionAuth");
const { traceContinuity } = require("../middleware/traceContinuity");
const { enforceGovernance } = require("../middleware/governanceEnforcement");
const { enforceTenantIsolation } = require("../middleware/tenantIsolation");
const { emitLifecycleEvent } = require("../services/executionEventEmitter");
const { getExecutionHistory } = require("../services/executionReplayLog");
const { logRejection } = require("../services/executionRejectionLogger");
const { stableStringify } = require("../utils/stableStringify");

const computeResultHash = (payload) => {
  const hash = crypto.createHash("sha256");
  hash.update(stableStringify(payload || {}));
  return hash.digest("hex");
};

router.post(
  "/execution/participate",
  executionAuth,
  traceContinuity,
  enforceGovernance,
  enforceTenantIsolation,
  async (req, res) => {
    try {
      const context = req.executionContext;
      const contract = context.contract;

      const inputPayload = req.body.payload || contract.execution?.payload || {};
      const inputHash = computeResultHash(inputPayload);

      const governanceDecision = String(
        contract.governance?.decision || "allow"
      ).toLowerCase();
      const requestedOutcome = String(
        contract.execution?.requested_outcome ||
          contract.execution?.outcome ||
          req.body.outcome ||
          "completed"
      ).toLowerCase();

      const startedEvent = await emitLifecycleEvent(
        "execution_started",
        context,
        {
          input_hash: inputHash,
          event_timestamp: contract.issued_at,
        }
      );

      if (governanceDecision === "deny" || governanceDecision === "block") {
        const blockedEvent = await emitLifecycleEvent(
          "execution_blocked",
          context,
          {
            reason: "governance_denied",
          }
        );

        return res.status(423).json({
          status: "blocked",
          reason: "governance_denied",
          execution_id: context.executionId,
          trace_id: context.traceId,
          tenant_id: context.tenantId,
          contract_hash: context.contractHash,
          events: {
            execution_started: startedEvent.eventId,
            execution_blocked: blockedEvent.eventId,
          },
          lineage: {
            start_hash: startedEvent.hash,
            end_hash: blockedEvent.hash,
          },
        });
      }

      if (requestedOutcome === "blocked") {
        const blockedEvent = await emitLifecycleEvent(
          "execution_blocked",
          context,
          {
            reason: "contract_blocked",
          }
        );

        return res.status(423).json({
          status: "blocked",
          reason: "contract_blocked",
          execution_id: context.executionId,
          trace_id: context.traceId,
          tenant_id: context.tenantId,
          contract_hash: context.contractHash,
          events: {
            execution_started: startedEvent.eventId,
            execution_blocked: blockedEvent.eventId,
          },
          lineage: {
            start_hash: startedEvent.hash,
            end_hash: blockedEvent.hash,
          },
        });
      }

      if (requestedOutcome === "failed") {
        const failedEvent = await emitLifecycleEvent(
          "execution_failed",
          context,
          {
            reason: req.body.failure_reason || "contract_failed",
          }
        );

        return res.status(500).json({
          status: "failed",
          execution_id: context.executionId,
          trace_id: context.traceId,
          tenant_id: context.tenantId,
          contract_hash: context.contractHash,
          events: {
            execution_started: startedEvent.eventId,
            execution_failed: failedEvent.eventId,
          },
          lineage: {
            start_hash: startedEvent.hash,
            end_hash: failedEvent.hash,
          },
        });
      }

      const outputPayload = req.body.output || contract.execution?.output || null;
      const resultHash = computeResultHash({
        input: inputPayload,
        output: outputPayload,
      });

      const completedEvent = await emitLifecycleEvent(
        "execution_completed",
        context,
        {
          result_hash: resultHash,
          output: outputPayload,
        }
      );

      return res.json({
        status: "completed",
        execution_id: context.executionId,
        trace_id: context.traceId,
        tenant_id: context.tenantId,
        contract_hash: context.contractHash,
        result_hash: resultHash,
        events: {
          execution_started: startedEvent.eventId,
          execution_completed: completedEvent.eventId,
        },
        lineage: {
          start_hash: startedEvent.hash,
          end_hash: completedEvent.hash,
        },
      });
    } catch (error) {
      console.error("Execution participation failed:", error);
      return res.status(500).json({
        status: "failed",
        error: "execution_failed",
        message: error.message,
      });
    }
  }
);

router.get("/execution/:executionId/history", executionAuth, async (req, res) => {
  try {
    const { executionId } = req.params;
    const history = await getExecutionHistory(executionId);

    if (!history.session) {
      return res.status(404).json({
        status: "not_found",
        execution_id: executionId,
      });
    }

    const actorTenant = req.user?.branch || req.headers["x-tenant-id"] || req.headers["x-branch"];
    if (!actorTenant) {
      const rejection = await logRejection({
        executionId,
        traceId: history.session.traceId,
        tenantId: history.session.tenantId,
        reason: "tenant_context_missing",
        details: {},
        statusCode: 403,
      });

      return res.status(403).json({
        status: "rejected",
        reason: "tenant_context_missing",
        execution_id: executionId,
        rejection_id: rejection.rejectionId,
      });
    }

    if (actorTenant !== history.session.tenantId) {
      const rejection = await logRejection({
        executionId,
        traceId: history.session.traceId,
        tenantId: history.session.tenantId,
        reason: "tenant_violation",
        details: { actor_tenant: actorTenant },
        statusCode: 403,
      });

      return res.status(403).json({
        status: "rejected",
        reason: "tenant_violation",
        execution_id: executionId,
        rejection_id: rejection.rejectionId,
      });
    }

    return res.json({
      status: "ok",
      execution_id: executionId,
      trace_id: history.session.traceId,
      tenant_id: history.session.tenantId,
      contract_hash: history.session.contractHash,
      session: history.session,
      events: history.events,
      lineage: history.lineage,
      rejections: history.rejections,
    });
  } catch (error) {
    console.error("Execution history fetch failed:", error);
    return res.status(500).json({
      status: "failed",
      error: "history_fetch_failed",
      message: error.message,
    });
  }
});

module.exports = router;
