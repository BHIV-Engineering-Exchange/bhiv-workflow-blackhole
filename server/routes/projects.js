const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const Department = require("../models/Department");
const authMiddleware = require("../middleware/auth");

// Get all projects (with filtering options)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { department, status, branch } = req.query;
    const filter = {};

    if (department) filter.department = department;
    if (status) filter.status = status;
    if (branch) filter.branch = branch;

    const projects = await Project.find(filter)
      .populate("department", "name color")
      .populate("lead", "name email profileImage")
      .populate("teamMembers", "name email profileImage")
      .populate("createdBy", "name email")
      .sort({ updatedAt: -1 });

    // Calculate progress for each project
    for (let project of projects) {
      await project.calculateProgress();
    }

    res.json({ success: true, data: projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single project with full details
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("department", "name color description")
      .populate("lead", "name email profileImage role")
      .populate("teamMembers", "name email profileImage role department")
      .populate({
        path: "tasks",
        populate: [
          { path: "assignee", select: "name email profileImage" },
          { path: "department", select: "name color" },
        ],
      })
      .populate("createdBy", "name email");

    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    // Calculate progress
    await project.calculateProgress();
    await project.save();

    res.json({ success: true, data: project });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new project (Admin only)
router.post("/", authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin only.",
      });
    }

    const {
      name,
      description,
      department,
      teamMembers,
      lead,
      status,
      priority,
      startDate,
      dueDate,
      color,
      branch,
    } = req.body;

    // Validate department exists
    const dept = await Department.findById(department);
    if (!dept) {
      return res.status(400).json({
        success: false,
        error: "Invalid department",
      });
    }

    const project = new Project({
      name,
      description,
      department,
      teamMembers: teamMembers || [],
      lead,
      status: status || "Planning",
      priority: priority || "Medium",
      startDate,
      dueDate,
      color: color || dept.color || "bg-blue-500",
      branch: branch || "blackhole_mumbai",
      createdBy: req.user.id,
    });

    await project.save();

    // Populate for response
    await project.populate([
      { path: "department", select: "name color" },
      { path: "lead", select: "name email profileImage" },
      { path: "teamMembers", select: "name email profileImage" },
    ]);

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update project (Admin only)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin only.",
      });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const allowedUpdates = [
      "name",
      "description",
      "department",
      "teamMembers",
      "lead",
      "status",
      "priority",
      "startDate",
      "dueDate",
      "completedDate",
      "color",
      "branch",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field];
      }
    });

    // If status changed to Completed, set completedDate
    if (req.body.status === "Completed" && !project.completedDate) {
      project.completedDate = new Date();
    }

    await project.save();
    await project.calculateProgress();
    await project.save();

    // Populate for response
    await project.populate([
      { path: "department", select: "name color" },
      { path: "lead", select: "name email profileImage" },
      { path: "teamMembers", select: "name email profileImage" },
    ]);

    res.json({ success: true, data: project });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete project (Admin only)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin only.",
      });
    }

    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    res.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add task to project
router.post("/:id/tasks", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const { taskId } = req.body;

    // Validate task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(400).json({ success: false, error: "Task not found" });
    }

    // Add task if not already in project
    if (!project.tasks.includes(taskId)) {
      project.tasks.push(taskId);
      await project.save();
      await project.calculateProgress();
      await project.save();
    }

    await project.populate({
      path: "tasks",
      populate: { path: "assignee", select: "name email profileImage" },
    });

    res.json({ success: true, data: project });
  } catch (error) {
    console.error("Error adding task to project:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove task from project
router.delete("/:id/tasks/:taskId", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    project.tasks = project.tasks.filter(
      (t) => t.toString() !== req.params.taskId
    );
    await project.save();
    await project.calculateProgress();
    await project.save();

    res.json({ success: true, data: project });
  } catch (error) {
    console.error("Error removing task from project:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add team member to project
router.post("/:id/team", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const { userId } = req.body;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ success: false, error: "User not found" });
    }

    // Add user if not already in team
    if (!project.teamMembers.includes(userId)) {
      project.teamMembers.push(userId);
      await project.save();
    }

    await project.populate("teamMembers", "name email profileImage role");

    res.json({ success: true, data: project });
  } catch (error) {
    console.error("Error adding team member:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove team member from project
router.delete("/:id/team/:userId", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    project.teamMembers = project.teamMembers.filter(
      (m) => m.toString() !== req.params.userId
    );
    await project.save();

    await project.populate("teamMembers", "name email profileImage role");

    res.json({ success: true, data: project });
  } catch (error) {
    console.error("Error removing team member:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get project statistics
router.get("/:id/stats", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate("tasks");
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const tasks = project.tasks || [];
    const stats = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === "Completed").length,
      inProgressTasks: tasks.filter((t) => t.status === "In Progress").length,
      pendingTasks: tasks.filter((t) => t.status === "Pending").length,
      teamSize: project.teamMembers?.length || 0,
      progress: project.progress,
      highPriorityTasks: tasks.filter((t) => t.priority === "High").length,
      overdueTasks: tasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Completed"
      ).length,
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error getting project stats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get projects by department
router.get("/department/:departmentId", authMiddleware, async (req, res) => {
  try {
    const projects = await Project.find({ department: req.params.departmentId })
      .populate("department", "name color")
      .populate("lead", "name email profileImage")
      .populate("teamMembers", "name email profileImage")
      .sort({ updatedAt: -1 });

    // Calculate progress for each project
    for (let project of projects) {
      await project.calculateProgress();
    }

    res.json({ success: true, data: projects });
  } catch (error) {
    console.error("Error fetching department projects:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Recalculate project progress
router.post("/:id/recalculate", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const progress = await project.calculateProgress();
    await project.save();

    res.json({ success: true, data: { progress } });
  } catch (error) {
    console.error("Error recalculating progress:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
