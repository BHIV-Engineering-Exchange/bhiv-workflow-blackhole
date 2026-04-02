module.exports = (req, res, next) => {
  if (!req.user || !["Tester", "Admin", "Manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied. Tester, Admin or Manager only." })
  }
  next()
}
