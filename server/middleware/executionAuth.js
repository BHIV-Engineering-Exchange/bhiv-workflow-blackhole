const jwt = require("jsonwebtoken");
const { logRejection } = require("../services/executionRejectionLogger");

// Hard guard: refuse to load if TANTRA_EXECUTION_KEY is absent.
// Without this, any caller knowing the public fallback string bypasses execution auth.
if (!process.env.TANTRA_EXECUTION_KEY) {
  throw new Error(
    "[executionAuth.js] TANTRA_EXECUTION_KEY environment variable is not set. " +
    "The server will not start without it. " +
    "Set TANTRA_EXECUTION_KEY to a long random secret before running."
  );
}

const executionAuth = async (req, res, next) => {
  const executionKey = req.headers["x-execution-key"];
  const expectedKey = process.env.TANTRA_EXECUTION_KEY;

  if (executionKey && executionKey === expectedKey) {
    req.executionAuthority = "setu";
    return next();
  }

  const token = req.header("x-auth-token");
  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
      req.user = decoded;

      if (decoded.role === "Admin" || decoded.role === "Manager") {
        return next();
      }
    } catch (error) {
      // Fall through to rejection
    }
  }

  const rejection = await logRejection({
    executionId: req.headers["x-execution-id"],
    traceId: req.headers["x-trace-id"],
    tenantId: req.headers["x-tenant-id"] || req.headers["x-branch"],
    reason: "unauthorized_execution",
    details: {
      has_execution_key: Boolean(executionKey),
      has_auth_token: Boolean(token),
    },
    statusCode: 401,
  });

  return res.status(401).json({
    status: "rejected",
    reason: "unauthorized_execution",
    execution_id: req.headers["x-execution-id"] || null,
    trace_id: req.headers["x-trace-id"] || null,
    rejection_id: rejection.rejectionId,
  });
};

module.exports = { executionAuth };
