const express = require("express")
const router = express.Router()
const Task = require("../models/Task")
const User = require("../models/User")
const auth = require("../middleware/auth")
const multer = require("multer")
const { uploadToCloudinary } = require("../utils/cloudinary")
const Notification = require("../models/Notification")

// Helper to get branch filter from request
const getBranchQuery = (req) => {
  const selectedBranch = req.headers['x-branch'] || req.query.branch;
  if (selectedBranch && selectedBranch !== 'all') {
    return { branch: selectedBranch };
  }
  return {};
};

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file) {
      console.error("No file provided in upload")
      return cb(new Error("No file provided"))
    }

    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/html",
    ]
    const validExtensions = /\.(pdf|doc|docx|txt|html)$/i
    const mimetypeValid = validTypes.includes(file.mimetype)
    const extnameValid = validExtensions.test(file.originalname)

    if (!mimetypeValid || !extnameValid) {
      console.error(`Invalid file: mimetype=${file.mimetype}, originalname=${file.originalname}`)
      return cb(new Error("Only PDF, DOC, DOCX, TXT, and HTML files are allowed"))
    }

    // Validate file content for HTML
    if (file.mimetype === "text/html") {
      if (!file.buffer) {
        console.error(`No buffer for file: originalname=${file.originalname}`)
        return cb(new Error("File buffer is missing"))
      }
      const content = file.buffer.toString("utf8", 0, 100)
      if (!content.startsWith("<!DOCTYPE html")) {
        console.error(`Invalid HTML content for file: originalname=${file.originalname}`)
        return cb(new Error("Invalid HTML file"))
      }
    }

    cb(null, true)
  },
})

// Get overdue tasks
router.get("/overdue", auth, async (req, res) => {
  try {
    const now = new Date()
    const branchQuery = getBranchQuery(req);
    
    // Find tasks that are overdue (dueDate < now) and not completed
    const tasks = await Task.find({
      ...branchQuery,
      dueDate: { $lt: now },
      status: { $ne: "Completed" }
    })
      .populate("department", "name color")
      .populate("dependencies", "title status")
      .sort({ dueDate: 1 }) // Sort by due date (oldest first)

    // Handle assignee population manually
    const tasksWithAssignees = await Promise.all(tasks.map(async (task) => {
      const taskObj = task.toObject()
      
      if (!task.assignee) {
        taskObj.assignee = null
        return taskObj
      }

      const actualUser = await User.findById(task.assignee).select("name avatar email stillExist")
      
      if (!actualUser) {
        taskObj.assignee = null
        return taskObj
      }

      const isActive = actualUser.stillExist === 1
      const isBlackhole = actualUser.email.toLowerCase().startsWith('blackhole')

      taskObj.assignee = {
        _id: actualUser._id,
        name: actualUser.name,
        avatar: actualUser.avatar,
        email: actualUser.email,
        stillExist: actualUser.stillExist,
        isActive,
        isBlackhole,
        status: !isActive ? 'inactive' : !isBlackhole ? 'non-blackhole' : 'active'
      }

      // Calculate days overdue
      const dueDate = new Date(task.dueDate)
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24))
      taskObj.daysOverdue = daysOverdue

      return taskObj
    }))

    res.json(tasksWithAssignees)
  } catch (error) {
    console.error("Error fetching overdue tasks:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Get all tasks - SHOW ALL EXISTING ASSIGNEES
router.get("/", auth, async (req, res) => {
  try {
    const { department, status, dueDate, priority } = req.query
    const branchQuery = getBranchQuery(req);

    // Build filter object with branch filter
    const filter = { ...branchQuery }
    if (department) filter.department = department
    if (status) filter.status = status
    if (priority) filter.priority = priority
    if (dueDate) {
      const date = new Date(dueDate)
      filter.dueDate = {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999)),
      }
    }

    const tasks = await Task.find(filter)
      .populate("department", "name color")
      .populate("dependencies", "title status")

    // Handle assignee population manually - SHOW ALL EXISTING ASSIGNEES
    const tasksWithAssignees = await Promise.all(tasks.map(async (task) => {
      const taskObj = task.toObject()
      
      if (!task.assignee) {
        taskObj.assignee = null
        return taskObj
      }

      // Get the actual user without any filtering - SHOW EXISTING ASSIGNEES
      const actualUser = await User.findById(task.assignee).select("name avatar email stillExist")
      
      if (!actualUser) {
        taskObj.assignee = null
        return taskObj
      }

      // Always show the assignee, but with status indicators
      const isActive = actualUser.stillExist === 1
      const isBlackhole = actualUser.email.toLowerCase().startsWith('blackhole')

      taskObj.assignee = {
        _id: actualUser._id,
        name: actualUser.name,
        avatar: actualUser.avatar,
        email: actualUser.email,
        stillExist: actualUser.stillExist,
        isActive,
        isBlackhole,
        status: !isActive ? 'inactive' : !isBlackhole ? 'non-blackhole' : 'active'
      }

      return taskObj
    }))

    res.json(tasksWithAssignees)
  } catch (error) {
    console.error("Error fetching tasks:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Get task by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('department', 'name')
      .populate('dependencies', 'title status')

    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    // Handle assignee manually - SHOW EXISTING ASSIGNEE
    const taskObj = task.toObject()
    
    if (task.assignee) {
      const actualUser = await User.findById(task.assignee).select("name avatar email stillExist")
      
      if (actualUser) {
        const isActive = actualUser.stillExist === 1
        const isBlackhole = actualUser.email.toLowerCase().startsWith('blackhole')

        taskObj.assignee = {
          _id: actualUser._id,
          name: actualUser.name,
          avatar: actualUser.avatar,
          email: actualUser.email,
          stillExist: actualUser.stillExist,
          isActive,
          isBlackhole,
          status: !isActive ? 'inactive' : !isBlackhole ? 'non-blackhole' : 'active'
        }
      } else {
        taskObj.assignee = null
      }
    }

    res.json(taskObj);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Task not found' });
    }
    res.status(500).send('Server Error');
  }
});

// Create new task - ONLY ALLOW ACTIVE BLACKHOLE USERS FOR NEW ASSIGNMENTS
router.post("/", auth, upload.single("document"), async (req, res) => {
  try {
    const { title, description, department, assignee, priority, status, dependencies, dueDate, user, links } = req.body;
    console.log("Received links", links);

    // Validate required fields
    if (!title || !department || !assignee) {
      return res.status(400).json({ error: "Title, department, and assignee are required" });
    }

    // For NEW tasks, verify assignee is an active user with blackhole email
    const assigneeUser = await User.findOne({ 
      _id: assignee, 
      stillExist: 1,
      email: { $regex: /^blackhole/, $options: 'i' }
    });
    if (!assigneeUser) {
      return res.status(400).json({ error: "Assignee not found, not active, or not authorized" });
    }

    let notes = "";
    let fileType = "";
    if (req.file) {
      console.log("File uploaded:", {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });

      const cloudinaryUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname);
      notes = `Document: ${cloudinaryUrl} (${req.file.originalname})`;
      fileType = req.file.mimetype;
    }

    // Create task with branch from header
    const selectedBranch = req.headers['x-branch'] || req.query.branch || 'blackhole_mumbai';
    const task = new Task({
      title,
      description,
      department,
      assignee,
      priority: priority || "Medium",
      status: status || "Pending",
      dependencies: dependencies ? JSON.parse(dependencies) : [],
      links: links ? links.split(',').map(link => link.trim()) : [],
      dueDate: dueDate || null,
      createdBy: user || req.user.id,
      notes,
      fileType,
      branch: selectedBranch,
    });
    const savedTask = await task.save();

    // Create notification for the assignee
    if (assigneeUser) {
      await Notification.create({
        recipient: assignee,
        type: "task_assigned",
        title: "New Task Assigned",
        message: `You have been assigned a new task: '${title}'.`,
        task: savedTask._id,
      });
    }

    // Populate fields for response
    const populatedTask = await Task.findById(savedTask._id)
      .populate("department", "name color")
      .populate("dependencies", "title status");

    // Handle assignee manually
    const taskObj = populatedTask.toObject()
    taskObj.assignee = {
      _id: assigneeUser._id,
      name: assigneeUser.name,
      avatar: assigneeUser.avatar,
      email: assigneeUser.email,
      stillExist: assigneeUser.stillExist,
      isActive: true,
      isBlackhole: true,
      status: 'active'
    }

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("task:created", taskObj);
    }

    res.status(201).json(taskObj);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: error.message || "Server error" });
  }
});

// Update task - ONLY ALLOW ACTIVE BLACKHOLE USERS FOR NEW ASSIGNMENTS
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    // If updating assignee, verify they're active and have blackhole email
    if (updates.assignee) {
      const assigneeUser = await User.findOne({ 
        _id: updates.assignee, 
        stillExist: 1,
        email: { $regex: /^blackhole/, $options: 'i' }
      });
      if (!assigneeUser) {
        return res.status(400).json({ error: "Assignee not found, not active, or not authorized" });
      }
    }

    // Find and update the task
    const task = await Task.findByIdAndUpdate(id, { $set: updates }, { new: true })
      .populate("department", "name color")
      .populate("dependencies", "title status")

    if (!task) {
      return res.status(404).json({ error: "Task not found" })
    }

    // Handle assignee manually - SHOW EXISTING ASSIGNEE
    const taskObj = task.toObject()
    
    if (task.assignee) {
      const actualUser = await User.findById(task.assignee).select("name avatar email stillExist")
      
      if (actualUser) {
        const isActive = actualUser.stillExist === 1
        const isBlackhole = actualUser.email.toLowerCase().startsWith('blackhole')

        taskObj.assignee = {
          _id: actualUser._id,
          name: actualUser.name,
          avatar: actualUser.avatar,
          email: actualUser.email,
          stillExist: actualUser.stillExist,
          isActive,
          isBlackhole,
          status: !isActive ? 'inactive' : !isBlackhole ? 'non-blackhole' : 'active'
        }
      } else {
        taskObj.assignee = null
      }
    }

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("task:updated", taskObj)
    }

    res.json(taskObj)
  } catch (error) {
    console.error("Error updating task:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Delete task
router.delete("/:id", auth, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id)

    if (!task) {
      return res.status(404).json({ error: "Task not found" })
    }

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("task:deleted", req.params.id)
    }

    res.json({ message: "Task deleted successfully" })
  } catch (error) {
    console.error("Error deleting task:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Get task dependencies
router.get("/:id/dependencies", auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate({
      path: "dependencies",
      populate: [
        { path: "department", select: "name color" }
      ],
    })

    if (!task) {
      return res.status(404).json({ error: "Task not found" })
    }

    // Handle assignees in dependencies manually - SHOW EXISTING ASSIGNEES
    const dependenciesWithAssignees = await Promise.all(task.dependencies.map(async (dep) => {
      const depObj = dep.toObject()
      
      if (dep.assignee) {
        const actualUser = await User.findById(dep.assignee).select("name avatar email stillExist")
        
        if (actualUser) {
          const isActive = actualUser.stillExist === 1
          const isBlackhole = actualUser.email.toLowerCase().startsWith('blackhole')

          depObj.assignee = {
            _id: actualUser._id,
            name: actualUser.name,
            avatar: actualUser.avatar,
            email: actualUser.email,
            stillExist: actualUser.stillExist,
            isActive,
            isBlackhole,
            status: !isActive ? 'inactive' : !isBlackhole ? 'non-blackhole' : 'active'
          }
        } else {
          depObj.assignee = null
        }
      }
      
      return depObj
    }))

    res.json(dependenciesWithAssignees)
  } catch (error) {
    console.error("Error fetching task dependencies:", error)
    res.status(500).json({ error: "Server error" })
  }
})

module.exports = router