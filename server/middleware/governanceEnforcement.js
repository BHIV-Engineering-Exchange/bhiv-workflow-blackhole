const { logRejection } = require("../services/executionRejectionLogger");

const normalizeRoute = (route) => {
  if (!route) {
    return "";
  }
  return route.replace(/^\/api/, "");
};

const enforceGovernance = async (req, res, next) => {
  const context = req.executionContext;
  const governance = context?.contract?.governance;

  if (!governance) {
    const rejection = await logRejection({
      executionId: context?.executionId,
      traceId: context?.traceId,
      tenantId: context?.tenantId,
      reason: "governance_missing",
      details: {},
      statusCode: 400,
    });

    return res.status(400).json({
      status: "rejected",
      reason: "governance_missing",
      execution_id: context?.executionId || null,
      trace_id: context?.traceId || null,
      rejection_id: rejection.rejectionId,
    });
  }

  const expectedAuthority = (process.env.SETU_AUTHORITY || "SETU").toLowerCase();
  const governanceAuthority = String(governance.authority || "").toLowerCase();
  if (governanceAuthority !== expectedAuthority) {
    const rejection = await logRejection({
      executionId: context?.executionId,
      traceId: context?.traceId,
      tenantId: context?.tenantId,
      reason: "governance_authority_mismatch",
      details: {
        expected: expectedAuthority,
        received: governance.authority || null,
      },
      statusCode: 403,
    });

    return res.status(403).json({
      status: "rejected",
      reason: "governance_authority_mismatch",
      execution_id: context?.executionId || null,
      trace_id: context?.traceId || null,
      rejection_id: rejection.rejectionId,
    });
  }

  const requestPath = req.originalUrl.split("?")[0];
  const normalizedRequest = normalizeRoute(requestPath);
  const normalizedContract = normalizeRoute(governance.route);

  if (!normalizedContract || normalizedContract !== normalizedRequest) {
    const rejection = await logRejection({
      executionId: context?.executionId,
      traceId: context?.traceId,
      tenantId: context?.tenantId,
      reason: "governance_route_mismatch",
      details: {
        expected_route: governance.route || null,
        request_route: requestPath,
      },
      statusCode: 403,
    });

    return res.status(403).json({
      status: "rejected",
      reason: "governance_route_mismatch",
      execution_id: context?.executionId || null,
      trace_id: context?.traceId || null,
      rejection_id: rejection.rejectionId,
    });
  }

  if (governance.method) {
    const requestMethod = req.method.toUpperCase();
    if (governance.method.toUpperCase() !== requestMethod) {
      const rejection = await logRejection({
        executionId: context?.executionId,
        traceId: context?.traceId,
        tenantId: context?.tenantId,
        reason: "governance_method_mismatch",
        details: {
          expected_method: governance.method,
          request_method: requestMethod,
        },
        statusCode: 403,
      });

      return res.status(403).json({
        status: "rejected",
        reason: "governance_method_mismatch",
        execution_id: context?.executionId || null,
        trace_id: context?.traceId || null,
        rejection_id: rejection.rejectionId,
      });
    }
  }

  if (process.env.SETU_GOVERNANCE_SIGNATURE) {
    if (governance.signature !== process.env.SETU_GOVERNANCE_SIGNATURE) {
      const rejection = await logRejection({
        executionId: context?.executionId,
        traceId: context?.traceId,
        tenantId: context?.tenantId,
        reason: "governance_signature_mismatch",
        details: {},
        statusCode: 403,
      });

      return res.status(403).json({
        status: "rejected",
        reason: "governance_signature_mismatch",
        execution_id: context?.executionId || null,
        trace_id: context?.traceId || null,
        rejection_id: rejection.rejectionId,
      });
    }
  }

  if (governance.expires_at) {
    const expiresAt = new Date(governance.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
      const rejection = await logRejection({
        executionId: context?.executionId,
        traceId: context?.traceId,
        tenantId: context?.tenantId,
        reason: "governance_expired",
        details: {
          expires_at: governance.expires_at,
        },
        statusCode: 403,
      });

      return res.status(403).json({
        status: "rejected",
        reason: "governance_expired",
        execution_id: context?.executionId || null,
        trace_id: context?.traceId || null,
        rejection_id: rejection.rejectionId,
      });
    }
  }

  return next();
};

module.exports = { enforceGovernance };
