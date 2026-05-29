const ExecutionSession = require("../models/ExecutionSession");
const {
  extractExecutionContract,
  normalizeIssuedAt,
  validateExecutionContract,
  computeContractHash,
  getContractVersion,
} = require("../services/executionContractService");
const { logRejection } = require("../services/executionRejectionLogger");

const traceContinuity = async (req, res, next) => {
  let contract;
  try {
    contract = extractExecutionContract(req);
  } catch (error) {
    const rejection = await logRejection({
      executionId: req.headers["x-execution-id"],
      traceId: req.headers["x-trace-id"],
      tenantId: req.headers["x-tenant-id"] || req.headers["x-branch"],
      reason: "contract_parse_failed",
      details: { message: error.message },
      statusCode: 400,
    });

    return res.status(400).json({
      status: "rejected",
      reason: "contract_parse_failed",
      rejection_id: rejection.rejectionId,
    });
  }

  if (!contract) {
    const rejection = await logRejection({
      executionId: req.headers["x-execution-id"],
      traceId: req.headers["x-trace-id"],
      tenantId: req.headers["x-tenant-id"] || req.headers["x-branch"],
      reason: "missing_execution_contract",
      details: {},
      statusCode: 400,
    });

    return res.status(400).json({
      status: "rejected",
      reason: "missing_execution_contract",
      rejection_id: rejection.rejectionId,
    });
  }

  const { ok, errors } = validateExecutionContract(contract);
  if (!ok) {
    const rejection = await logRejection({
      executionId: contract.execution_id,
      traceId: contract.trace_id,
      tenantId: contract.tenant_id,
      reason: "invalid_execution_contract",
      details: { errors },
      statusCode: 400,
    });

    return res.status(400).json({
      status: "rejected",
      reason: "invalid_execution_contract",
      execution_id: contract.execution_id || null,
      trace_id: contract.trace_id || null,
      rejection_id: rejection.rejectionId,
      errors,
    });
  }

  const executionId = contract.execution_id;
  const traceId = contract.trace_id;
  const tenantId = contract.tenant_id;

  const headerExecutionId = req.headers["x-execution-id"];
  if (headerExecutionId && headerExecutionId !== executionId) {
    const rejection = await logRejection({
      executionId,
      traceId,
      tenantId,
      reason: "execution_id_mismatch",
      details: {
        header_execution_id: headerExecutionId,
      },
      statusCode: 409,
    });

    return res.status(409).json({
      status: "rejected",
      reason: "execution_id_mismatch",
      execution_id: executionId,
      trace_id: traceId,
      rejection_id: rejection.rejectionId,
    });
  }

  const headerTraceId = req.headers["x-trace-id"];
  if (headerTraceId && headerTraceId !== traceId) {
    const rejection = await logRejection({
      executionId,
      traceId,
      tenantId,
      reason: "trace_id_mismatch",
      details: {
        header_trace_id: headerTraceId,
      },
      statusCode: 409,
    });

    return res.status(409).json({
      status: "rejected",
      reason: "trace_id_mismatch",
      execution_id: executionId,
      trace_id: traceId,
      rejection_id: rejection.rejectionId,
    });
  }

  const contractHash = computeContractHash(contract);
  const contractVersion = getContractVersion(contract);
  const issuedAt = normalizeIssuedAt(contract.issued_at);

  let session = await ExecutionSession.findOne({ executionId }).lean();
  if (session) {
    if (session.traceId !== traceId) {
      const rejection = await logRejection({
        executionId,
        traceId,
        tenantId,
        reason: "trace_mutation",
        details: {
          stored_trace_id: session.traceId,
        },
        statusCode: 409,
      });

      return res.status(409).json({
        status: "rejected",
        reason: "trace_mutation",
        execution_id: executionId,
        trace_id: traceId,
        rejection_id: rejection.rejectionId,
      });
    }

    if (session.tenantId !== tenantId) {
      const rejection = await logRejection({
        executionId,
        traceId,
        tenantId,
        reason: "tenant_violation",
        details: {
          stored_tenant_id: session.tenantId,
        },
        statusCode: 403,
      });

      return res.status(403).json({
        status: "rejected",
        reason: "tenant_violation",
        execution_id: executionId,
        trace_id: traceId,
        rejection_id: rejection.rejectionId,
      });
    }

    if (session.contractHash !== contractHash) {
      const rejection = await logRejection({
        executionId,
        traceId,
        tenantId,
        reason: "contract_mutation",
        details: {
          stored_contract_hash: session.contractHash,
        },
        statusCode: 409,
      });

      return res.status(409).json({
        status: "rejected",
        reason: "contract_mutation",
        execution_id: executionId,
        trace_id: traceId,
        rejection_id: rejection.rejectionId,
      });
    }
  } else {
    try {
      session = await ExecutionSession.create({
        executionId,
        traceId,
        tenantId,
        contractHash,
        contractVersion,
        contract,
        governance: contract.governance || {},
        issuedAt,
        receivedAt: new Date(),
      });
    } catch (error) {
      if (error.code === 11000) {
        session = await ExecutionSession.findOne({ executionId }).lean();
      } else {
        throw error;
      }
    }
  }

  req.executionContext = {
    executionId,
    traceId,
    tenantId,
    contract,
    contractHash,
    contractVersion,
    issuedAt,
    session,
  };

  return next();
};

module.exports = { traceContinuity };
