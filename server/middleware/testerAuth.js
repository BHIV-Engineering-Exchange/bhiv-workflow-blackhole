module.exports = (req, res, next) => {
  if (!req.user || (req.user.role !== "Tester" && req.user.role !== "Admin")) {
    return res.status(403).json({ error: "Access denied. Tester or Admin only." })
  }
  next()
}
