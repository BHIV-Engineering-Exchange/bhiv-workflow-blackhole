const express = require("express")
const router = express.Router()
const Task = require("../models/Task")
const User = require("../models/User")
const Department = require("../models/Department")
const auth = require("../middleware/auth")
const multer = require("multer")
const { uploadToCloudinary } = require("../utils/cloudinary")
const Notification = require("../models/Notification")
const { isValidOrgEmail, ORG_EMAIL_ERROR } = require("../utils/orgEmail")
const mongoose = require("mongoose")


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
      const isBlackhole = isValidOrgEmail(actualUser.email)

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

// Maximum tasks returnable in a single unpaginated request
const MAX_UNPAGINATED_LIMIT = 100

// Get all tasks - optimized with aggregation (eliminates N+1 query)
router.get("/", auth, async (req, res) => {
  try {
    const { department, status, dueDate, priority, page, limit, search, submissionStatus } = req.query
    const branchQuery = getBranchQuery(req)

    const limitNum = parseInt(limit) || 0
    if (limitNum === 0) {
      return res.status(400).json({
        error: "Pagination required. Provide ?limit=N&page=P (max limit without page: use limit <= " + MAX_UNPAGINATED_LIMIT + ")",
        hint: "Use ?status=Completed&page=1&limit=20"
      })
    }
    if (limitNum > MAX_UNPAGINATED_LIMIT) {
      return res.status(400).json({
        error: `limit exceeds maximum allowed value of ${MAX_UNPAGINATED_LIMIT}`,
        hint: `Use limit <= ${MAX_UNPAGINATED_LIMIT} with page parameter`
      })
    }

    const filter = { ...branchQuery }
    if (department) filter.department = new mongoose.Types.ObjectId(department)
    if (status) filter.status = status
    if (priority) filter.priority = priority
    if (dueDate) {
      const date = new Date(dueDate)
      filter.dueDate = {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999)),
      }
    }
    if (search) {
      const re = { $regex: search, $options: "i" }
      filter.$or = [{ title: re }, { description: re }]
    }

    const pageNum = parseInt(page) || 1
    const skip = (pageNum - 1) * limitNum

    // Base pipeline stages shared by both data + count
    const basePipeline = [
      { $match: filter },
      // Join submissions only when submissionStatus filter is active
      ...( submissionStatus ? [
        {
          $lookup: {
            from: "tasksubmissions",
            localField: "_id",
            foreignField: "task",
            pipeline: [{ $project: { status: 1 } }],
            as: "_sub"
          }
        },
        {
          $match: submissionStatus === "noSubmission"
            ? { "_sub": { $size: 0 } }
            : { "_sub.status": submissionStatus.charAt(0).toUpperCase() + submissionStatus.slice(1) }
        }
      ] : [] )
    ]

    const dataPipeline = [
      ...basePipeline,
      { $sort: { updatedAt: -1 } },
      { $skip: skip }, { $limit: limitNum },
      {
        $lookup: {
          from: "users",
          localField: "assignee",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1, avatar: 1, email: 1, stillExist: 1 } }],
          as: "assigneeData"
        }
      },
      {
        $lookup: {
          from: "departments",
          localField: "department",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1, color: 1 } }],
          as: "departmentData"
        }
      },
      {
        $addFields: {
          department: { $arrayElemAt: ["$departmentData", 0] },
          assignee: {
            $let: {
              vars: { u: { $arrayElemAt: ["$assigneeData", 0] } },
              in: {
                $cond: {
                  if: { $not: ["$$u"] },
                  then: null,
                  else: {
                    _id: "$$u._id",
                    name: "$$u.name",
                    avatar: "$$u.avatar",
                    email: "$$u.email",
                    stillExist: "$$u.stillExist",
                    isActive: { $eq: ["$$u.stillExist", 1] },
                    isBlackhole: true
                  }
                }
              }
            }
          }
        }
      },
      { $project: { assigneeData: 0, departmentData: 0, _sub: 0 } }
    ]

    const countPipeline = [...basePipeline, { $count: "total" }]

    const [tasks, countResult] = await Promise.all([
      Task.aggregate(dataPipeline),
      Task.aggregate(countPipeline)
    ])
    const total = countResult[0]?.total ?? 0
    res.json({ tasks, total, page: pageNum, pages: Math.ceil(total / limitNum) })
  } catch (error) {
    console.error("Error fetching tasks:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Get aggregate stats for all completed tasks (used by CompletedTasksStats)
router.get("/stats", auth, async (req, res) => {
  try {
    const branchQuery = getBranchQuery(req)
    const matchFilter = { ...branchQuery, status: "Completed" }

    // One aggregation: join submissions, group by status, group by department
    const [statusResult, deptResult] = await Promise.all([
      Task.aggregate([
        { $match: matchFilter },
        {
          $lookup: {
            from: "tasksubmissions",
            localField: "_id",
            foreignField: "task",
            pipeline: [{ $project: { status: 1 } }],
            as: "sub"
          }
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: [{ $size: "$sub" }, 0] },
                "NoSubmission",
                { $arrayElemAt: ["$sub.status", 0] }
              ]
            },
            count: { $sum: 1 }
          }
        }
      ]),
      Task.aggregate([
        { $match: matchFilter },
        {
          $lookup: {
            from: "tasksubmissions",
            localField: "_id",
            foreignField: "task",
            pipeline: [{ $project: { status: 1 } }],
            as: "sub"
          }
        },
        {
          $group: {
            _id: "$department",
            total: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: [{ $arrayElemAt: ["$sub.status", 0] }, "Approved"] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: [{ $arrayElemAt: ["$sub.status", 0] }, "Pending"] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: [{ $arrayElemAt: ["$sub.status", 0] }, "Rejected"] }, 1, 0] } },
            noSubmission: { $sum: { $cond: [{ $eq: [{ $size: "$sub" }, 0] }, 1, 0] } }
          }
        }
      ])
    ])

    const counts = { Approved: 0, Pending: 0, Rejected: 0, NoSubmission: 0 }
    statusResult.forEach(r => { counts[r._id] = r.count })
    const total = counts.Approved + counts.Pending + counts.Rejected + counts.NoSubmission

    res.json({
      approved: counts.Approved,
      pending: counts.Pending,
      rejected: counts.Rejected,
      noSubmission: counts.NoSubmission,
      total,
      byDepartment: deptResult
    })
  } catch (error) {
    console.error("Error fetching task stats:", error)
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
        const isBlackhole = isValidOrgEmail(actualUser.email)

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

// Create new task — assignee must be active and belong to the same branch as the task
router.post("/", auth, upload.single("document"), async (req, res) => {
  try {
    const { title, description, department, assignee, priority, status, dependencies, dueDate, user, links } = req.body;
    console.log("Received links", links);

    // Validate required fields
    if (!title || !department || !assignee) {
      return res.status(400).json({ error: "Title, department, and assignee are required" });
    }

    const selectedBranch = req.headers['x-branch'] || req.query.branch || 'blackhole_mumbai';

    const assigneeFilter = { _id: assignee, stillExist: 1 };
    if (selectedBranch && selectedBranch !== 'all') {
      assigneeFilter.branch = selectedBranch;
    }

    const assigneeUser = await User.findOne(assigneeFilter);
    if (!assigneeUser) {
      return res.status(400).json({ error: "Assignee not found, not active, or not a member of this branch" });
    }
    if (!isValidOrgEmail(assigneeUser.email)) {
      return res.status(400).json({ error: ORG_EMAIL_ERROR });
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

    // Notify all testers about new task
    try {
      const dept = await Department.findById(department).select("name");
      const testers = await User.find({ role: "Tester", stillExist: 1 });
      for (const tester of testers) {
        await Notification.create({
          recipient: tester._id,
          type: "task_created_for_tester",
          title: "New Task Created",
          message: `New task "${title}" created in ${dept?.name || "Unknown"} department`,
          task: savedTask._id,
        });
      }
    } catch (notifErr) {
      console.error("Error notifying testers:", notifErr);
    }

    // Populate fields for response
    const populatedTask = await Task.findById(savedTask._id)
      .populate("department", "name color")
      .populate("dependencies", "title status");

    // Handle assignee manually
    const taskObj = populatedTask.toObject()
    const isBh = isValidOrgEmail(assigneeUser.email)
    taskObj.assignee = {
      _id: assigneeUser._id,
      name: assigneeUser.name,
      avatar: assigneeUser.avatar,
      email: assigneeUser.email,
      stillExist: assigneeUser.stillExist,
      isActive: true,
      isBlackhole: isBh,
      status: isBh ? 'active' : 'non-blackhole'
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

// Update task — reassign only to active users in the task’s branch
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    if (updates.assignee) {
      const existing = await Task.findById(id).select("branch")
      if (!existing) {
        return res.status(404).json({ error: "Task not found" })
      }
      const branchForAssignee = req.headers['x-branch'] || req.query.branch || existing.branch || 'blackhole_mumbai'
      const assigneeFilter = { _id: updates.assignee, stillExist: 1 }
      if (branchForAssignee && branchForAssignee !== 'all') {
        assigneeFilter.branch = branchForAssignee
      }
      const assigneeUser = await User.findOne(assigneeFilter)
      if (!assigneeUser) {
        return res.status(400).json({ error: "Assignee not found, not active, or not a member of this branch" })
      }
      if (!isValidOrgEmail(assigneeUser.email)) {
        return res.status(400).json({ error: ORG_EMAIL_ERROR })
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
        const isBlackhole = isValidOrgEmail(actualUser.email)

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
          const isBlackhole = isValidOrgEmail(actualUser.email)

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