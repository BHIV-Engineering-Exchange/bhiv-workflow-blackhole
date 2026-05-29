const jwt = require("jsonwebtoken");
const { logRejection } = require("../services/executionRejectionLogger");

const executionAuth = async (req, res, next) => {
  const executionKey = req.headers["x-execution-key"];
  const expectedKey =
    process.env.TANTRA_EXECUTION_KEY ||
    process.env.EXECUTION_AUTH_KEY ||
    "niyantran-dev-exec-key";

  if (executionKey && executionKey === expectedKey) {
    req.executionAuthority = "setu";
    return next();
  }

  const token = req.header("x-auth-token");
  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "jwtSecret"
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
