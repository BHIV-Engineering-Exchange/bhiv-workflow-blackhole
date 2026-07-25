const ExecutionSession = require("../models/ExecutionSession");
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

  // Persist resolved actor to the session record (Phase E)
  const executionId = context?.executionId;
  if (executionId) {
    let actorId = null;
    let actorType = null;

    if (req.user) {
      actorId = req.user.id || req.user._id || req.user.email || null;
      actorType = "user";
    } else if (req.executionAuthority) {
      actorId = req.executionAuthority;
      actorType = "authority";
    }

    if (actorId && actorType) {
      try {
        await ExecutionSession.updateOne(
          { executionId },
          { $set: { actorId, actorType } }
        );
        if (req.executionContext && req.executionContext.session) {
          req.executionContext.session.actorId = actorId;
          req.executionContext.session.actorType = actorType;
        }
      } catch (err) {
        console.error("[tenantIsolation] Failed to persist actor identity:", err.message);
      }
    }
  }

  req.executionContext.actorTenantId = actorTenant;
  return next();
};

module.exports = { enforceTenantIsolation };
