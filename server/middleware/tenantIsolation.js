const { logRejection } = require("../services/executionRejectionLogger");

const enforceTenantIsolation = async (req, res, next) => {
  const context = req.executionContext;
  const tenantId = context?.tenantId;

  const headerTenant = req.headers["x-tenant-id"] || req.headers["x-branch"];
  const actorTenant = req.user?.branch || headerTenant || null;

  if (!tenantId || !actorTenant) {
    const rejection = await logRejection({
      executionId: context?.executionId,
      traceId: context?.traceId,
      tenantId,
      reason: "tenant_context_missing",
      details: {
        actor_tenant: actorTenant,
      },
      statusCode: 403,
    });

    return res.status(403).json({
      status: "rejected",
      reason: "tenant_context_missing",
      execution_id: context?.executionId || null,
      trace_id: context?.traceId || null,
      rejection_id: rejection.rejectionId,
    });
  }

  if (actorTenant !== tenantId) {
    const rejection = await logRejection({
      executionId: context?.executionId,
      traceId: context?.traceId,
      tenantId,
      reason: "tenant_violation",
      details: {
        actor_tenant: actorTenant,
      },
      statusCode: 403,
    });

    return res.status(403).json({
      status: "rejected",
      reason: "tenant_violation",
      execution_id: context?.executionId || null,
      trace_id: context?.traceId || null,
      rejection_id: rejection.rejectionId,
    });
  }

  req.executionContext.actorTenantId = actorTenant;
  return next();
};

module.exports = { enforceTenantIsolation };
