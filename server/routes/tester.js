const express = require("express")
const router = express.Router()
const auth = require("../middleware/auth")
const testerAuth = require("../middleware/testerAuth")
const Task = require("../models/Task")
const TaskSubmission = require("../models/TaskSubmission")
const TaskEvaluation = require("../models/TaskEvaluation")
const User = require("../models/User")
const Department = require("../models/Department")
const Notification = require("../models/Notification")

// ─── DASHBOARD STATS ────────────────────────────────────────────
router.get("/dashboard-stats", auth, testerAuth, async (req, res) => {
  try {
    const branchQuery = req.query.branch ? { branch: req.query.branch } : {}

    const [totalTasks, pendingTasks, completedTasks, totalEvaluations, overdueTasks] = await Promise.all([
      Task.countDocuments(branchQuery),
      Task.countDocuments({ ...branchQuery, status: "Pending" }),
      Task.countDocuments({ ...branchQuery, status: "Completed" }),
      TaskEvaluation.countDocuments({ evaluatedBy: req.user.id }),
      Task.countDocuments({
        ...branchQuery,
        dueDate: { $lt: new Date() },
        status: { $ne: "Completed" },
      }),
    ])

    const recentEvaluations = await TaskEvaluation.find({ evaluatedBy: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("task", "title status")
      .populate("submittedBy", "name")

    const verdictStats = await TaskEvaluation.aggregate([
      { $match: { evaluatedBy: req.user.id } },
      { $group: { _id: "$finalVerdict", count: { $sum: 1 } } },
    ])

    res.json({
      totalTasks,
      pendingTasks,
      completedTasks,
      totalEvaluations,
      overdueTasks,
      recentEvaluations,
      verdictStats,
    })
  } catch (error) {
    console.error("Error fetching tester dashboard stats:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// ─── TASKS (department-wise, user-wise) ─────────────────────────
router.get("/tasks", auth, testerAuth, async (req, res) => {
  try {
    const { department, assignee, status, priority, search } = req.query
    const filter = {}
    if (department && department !== "all") filter.department = department
    if (assignee && assignee !== "all") filter.assignee = assignee
    if (status && status !== "all") filter.status = status
    if (priority && priority !== "all") filter.priority = priority

    const tasks = await Task.find(filter)
      .populate("department", "name color")
      .populate("assignee", "name email")
      .sort({ createdAt: -1 })

    let result = tasks
    if (search) {
      const s = search.toLowerCase()
      result = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          t.assignee?.name?.toLowerCase().includes(s) ||
          t.department?.name?.toLowerCase().includes(s)
      )
    }

    res.json(result)
  } catch (error) {
    console.error("Error fetching tester tasks:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// ─── DEPARTMENTS LIST (for filter dropdowns) ────────────────────
router.get("/departments", auth, testerAuth, async (req, res) => {
  try {
    const departments = await Department.find().select("name color").sort({ name: 1 })
    res.json(departments)
  } catch (error) {
    console.error("Error fetching departments:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// ─── USERS LIST (for filter dropdowns) ──────────────────────────
router.get("/users", auth, testerAuth, async (req, res) => {
  try {
    const users = await User.find({ stillExist: 1 }).select("name email role department").sort({ name: 1 })
    res.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// ─── EVALUATIONS CRUD ───────────────────────────────────────────
router.post("/evaluations", auth, testerAuth, async (req, res) => {
  try {
    const evaluation = new TaskEvaluation({
      ...req.body,
      evaluatedBy: req.user.id,
    })
    await evaluation.save()

    const admins = await User.find({ role: "Admin", stillExist: 1 })
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        type: "evaluation_submitted",
        title: "New Task Evaluation",
        message: `Tester submitted evaluation for: ${req.body.projectName || "Unknown Project"}`,
        task: req.body.task,
      })
    }

    res.status(201).json(evaluation)
  } catch (error) {
    console.error("Error creating evaluation:", error)
    res.status(500).json({ error: "Server error" })
  }
})

router.get("/evaluations", auth, testerAuth, async (req, res) => {
  try {
    const filter = req.user.role === "Tester" ? { evaluatedBy: req.user.id } : {}
    const evaluations = await TaskEvaluation.find(filter)
      .populate("task", "title status priority dueDate department assignee")
      .populate("submittedBy", "name email")
      .populate("evaluatedBy", "name")
      .sort({ createdAt: -1 })

    res.json(evaluations)
  } catch (error) {
    console.error("Error fetching evaluations:", error)
    res.status(500).json({ error: "Server error" })
  }
})

router.get("/evaluations/:id", auth, testerAuth, async (req, res) => {
  try {
    const evaluation = await TaskEvaluation.findById(req.params.id)
      .populate("task")
      .populate("submittedBy", "name email")
      .populate("evaluatedBy", "name email")

    if (!evaluation) return res.status(404).json({ error: "Evaluation not found" })
    res.json(evaluation)
  } catch (error) {
    console.error("Error fetching evaluation:", error)
    res.status(500).json({ error: "Server error" })
  }
})

router.put("/evaluations/:id", auth, testerAuth, async (req, res) => {
  try {
    const evaluation = await TaskEvaluation.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    )
    if (!evaluation) return res.status(404).json({ error: "Evaluation not found" })
    res.json(evaluation)
  } catch (error) {
    console.error("Error updating evaluation:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// ─── ALERTS (overdue + date-based) ──────────────────────────────
router.get("/alerts", auth, testerAuth, async (req, res) => {
  try {
    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [overdueTasks, dueSoonTasks, recentlyCreated] = await Promise.all([
      Task.find({ dueDate: { $lt: now }, status: { $ne: "Completed" } })
        .populate("department", "name color")
        .populate("assignee", "name email")
        .sort({ dueDate: 1 }),
      Task.find({
        dueDate: { $gte: now, $lte: threeDaysFromNow },
        status: { $ne: "Completed" },
      })
        .populate("department", "name color")
        .populate("assignee", "name email")
        .sort({ dueDate: 1 }),
      Task.find({ createdAt: { $gte: oneDayAgo } })
        .populate("department", "name color")
        .populate("assignee", "name email")
        .sort({ createdAt: -1 }),
    ])

    res.json({ overdueTasks, dueSoonTasks, recentlyCreated })
  } catch (error) {
    console.error("Error fetching tester alerts:", error)
    res.status(500).json({ error: "Server error" })
  }
})

module.exports = router
