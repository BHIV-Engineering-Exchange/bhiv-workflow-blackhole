const jwt = require("jsonwebtoken");

// Hard guard: refuse to load this middleware if JWT_SECRET is absent.
// This keeps the startup env-validation in sync with the actual point of use
// and ensures no request can be verified against a predictable fallback secret.
if (!process.env.JWT_SECRET) {
  throw new Error(
    "[auth.js] JWT_SECRET environment variable is not set. " +
    "The server will not start without it. " +
    "Set JWT_SECRET to a long random secret before running."
  );
}

module.exports = (req, res, next) => {
  const token = req.header("x-auth-token");

  if (!token) {
    return res.status(401).json({ error: "No token, authorization denied" });
  }

  try {
    // JWT_SECRET is guaranteed non-empty by the guard above.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // ✅ This ensures req.user.id will be accessible
    next();
  } catch (error) {
    res.status(401).json({ error: "Token is not valid" });
  }
};
