const express = require("express")
const router = express.Router()
const TaskSubmission = require("../models/TaskSubmission")
const Task = require("../models/Task")
const multer = require("multer")
const { uploadToCloudinary } = require("../utils/cloudinary")
const Notification = require("../models/Notification")
const User = require("../models/User")
const auth = require("../middleware/auth")
const crypto = require("crypto")
const { emitTaskSubmittedEvent, emitTaskCompletedEvent, emitTaskFailedEvent } = require("../services/taskExecutionBridge")
const { invokeParikshak } = require("../services/parikshakService")

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file) {
      return cb(null, true) // Allow empty file field
    }

    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg",
    ]
    const validExtensions = /\.(pdf|doc|docx|png|jpg|jpeg)$/i
    const mimetypeValid = validTypes.includes(file.mimetype)
    const extnameValid = validExtensions.test(file.originalname)

    if (!mimetypeValid || !extnameValid) {
      console.error(`Invalid file: mimetype=${file.mimetype}, originalname=${file.originalname}`)
      return cb(new Error("Only PDF, DOC, DOCX, PNG, and JPEG files are allowed"))
    }

    cb(null, true)
  },
})

const MAX_UNPAGINATED_LIMIT = 100

// Get all submissions - paginated, only active users
router.get("/", auth, async (req, res) => {
  try {
    const { page, limit } = req.query
    const limitNum = parseInt(limit) || 0

    if (limitNum === 0) {
      return res.status(400).json({
        error: "Pagination required. Provide ?limit=N&page=P",
        hint: "Use ?page=1&limit=20"
      })
    }
    if (limitNum > MAX_UNPAGINATED_LIMIT) {
      return res.status(400).json({
        error: `limit exceeds maximum allowed value of ${MAX_UNPAGINATED_LIMIT}`,
        hint: `Use limit <= ${MAX_UNPAGINATED_LIMIT}`
      })
    }

    const pageNum = parseInt(page) || 1
    const activeUserIds = await User.distinct("_id", { stillExist: 1 })
    const [submissions, total] = await Promise.all([
      TaskSubmission.find()
        .populate("task", "title status")
        .populate({ path: "user", select: "name email stillExist", match: { stillExist: 1 } })
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      TaskSubmission.countDocuments({ user: { $in: activeUserIds } })
    ])
    res.json({ submissions: submissions.filter(s => s.user), total, page: pageNum, pages: Math.ceil(total / limitNum) })
  } catch (error) {
    console.error("Error fetching submissions:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Get submission by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const submission = await TaskSubmission.findById(req.params.id)
      .populate("task", "title status department assignee")
      .populate({
        path: "user",
        select: "name email stillExist",
        match: { stillExist: 1 } // Only populate active users
      })
      .populate("reviewHistory.reviewedBy", "name email")

    if (!submission || !submission.user) {
      return res.status(404).json({ error: "Submission not found or user no longer active" })
    }

    res.json(submission)
  } catch (error) {
    console.error("Error fetching submission:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Get submission by task ID
router.get("/task/:taskId", auth, async (req, res) => {
  try {
    const submission = await TaskSubmission.findOne({ task: req.params.taskId })
      .populate("task", "title status")
      .populate({
        path: "user",
        select: "name email stillExist",
        match: { stillExist: 1 } // Only populate active users
      })
      .populate("reviewHistory.reviewedBy", "name email")

    if (!submission || !submission.user) {
      return res.status(404).json({ error: "Submission not found or user no longer active" })
    }

    res.json(submission)
  } catch (error) {
    console.error("Error fetching submission by task:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Create new submission - ONLY ALLOW ACTIVE USERS
router.post("/", auth, upload.single("document"), async (req, res) => {
  try {
    const { task: taskId, githubLink, notes, originalSubmission, userId } = req.body

    // Get or generate trace_id (make it optional for backward compatibility)
    let traceId = req.headers["x-trace-id"];
    if (!traceId) {
      traceId = `trace_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      console.log(`[TRACE_WARNING] Auto-generated trace_id for task submission ${taskId}: ${traceId}`);
    } else {
      console.log(`[TRACE_RECEIVED] Submission received - trace_id=${traceId}, task_id=${taskId}`);
    }

    // Check if user is active
    const user = await User.findOne({ _id: userId, stillExist: 1 });
    if (!user) {
      return res.status(404).json({ error: "User not found or no longer active" });
    }

    // Check if task exists
    const task = await Task.findById(taskId)
    if (!task) {
      return res.status(404).json({ error: "Task not found" })
    }

    // Validate: Prevent duplicate original submission
    if (!originalSubmission) {
      const existingSubmission = await TaskSubmission.findOne({
        task: taskId,
        originalSubmission: { $exists: false },
      })

      if (existingSubmission) {
        console.error(`[TRACE_FAILURE] Duplicate submission attempt - trace_id=${traceId}, task_id=${taskId}`);
        
        // Emit failure event
        try {
          await emitTaskFailedEvent(
            { task: taskId, user: userId, _id: "duplicate" },
            "duplicate_submission",
            traceId,
            task.branch
          );
        } catch (emitErr) {
          console.error("Failed to emit failure event:", emitErr);
        }

        return res.status(400).json({ 
          error: "A submission already exists for this task",
          reason: "duplicate_submission",
          trace_id: traceId
        })
      }
    }

    let documentLink = ""
    let fileType = ""
    if (req.file) {
      console.log("File uploaded:", {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      })

      const cloudinaryUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname)
      documentLink = cloudinaryUrl
      fileType = req.file.mimetype
    }

    // Create new submission
    const newSubmission = new TaskSubmission({
      task: taskId,
      user: userId,
      githubLink: githubLink || "",
      notes: notes || "",
      documentLink,
      fileType,
      originalSubmission: originalSubmission ? originalSubmission : undefined,
    })

    const submission = await newSubmission.save()

    // Populate user information
    await submission.populate("user", "name")

    // 🔄 AUTO STATUS UPDATE: Update task status based on submission type
    if (!originalSubmission) {
      // Original submission - mark as Completed
      if (task.status !== "Completed") {
        task.status = "Completed"
        task.progress = 100
        console.log(`✅ Task ${taskId} marked as Completed (Submission received)`);
        await task.save()
      }
    } else {
      // Revision submission - if task was Pending, mark as In Progress
      if (task.status === "Pending") {
        task.status = "In Progress"
        console.log(`✅ Auto-updated task ${taskId} status: Pending → In Progress (Revision submitted)`);
        await task.save()
      }
    }

    // Emit execution event with trace propagation
    let execContext;
    try {
      execContext = await emitTaskSubmittedEvent(submission, traceId, task.branch);
      console.log(`[TRACE_EMITTED] Submission event emitted - trace_id=${execContext.traceId}`);
    } catch (execErr) {
      console.error("[TRACE_FAILURE] Failed to emit submission event:", execErr);
    }

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("submission-created", {
        submission,
        taskId,
        trace_id: execContext?.traceId
      })
    }

    // Workflow: repo submissions go to Tester first; others continue to Admin
    const hasRepo = !!(githubLink && String(githubLink).trim())
    if (hasRepo) {
      const testers = await User.find({ role: "Tester", stillExist: 1 })
      for (const tester of testers) {
        await Notification.create({
          recipient: tester._id,
          type: "task_submitted",
          title: "Repo Submitted for Testing",
          message: `Submission by ${submission.user.name} for task: '${task.title}'. Please evaluate this repo.`,
          task: taskId,
        })
      }
    } else {
      const admins = await User.find({ role: "Admin", stillExist: 1 })
      for (const admin of admins) {
        await Notification.create({
          recipient: admin._id,
          type: "task_submitted",
          title: "Task Submitted",
          message: `Submission by ${submission.user.name} for task: '${task.title}'. Please review it.`,
          task: taskId,
        })
      }
    }

    // Phase 1: Trigger PARIKSHAK Review asynchronously
    // We don't await this so the client gets a fast response.
    invokeParikshak(submission._id, execContext?.traceId || traceId, req.io).catch(err => {
      console.error("[PARIKSHAK] Uncaught error triggering review:", err);
    });

    res.status(201).json({
      ...submission.toObject(),
      trace_id: execContext?.traceId,
      execution_id: execContext?.executionId
    })
  } catch (error) {
    console.error("Error creating submission:", error)
    res.status(500).json({ error: error.message || "Server error" })
  }
})

// Update submission - ONLY ALLOW ACTIVE USERS (also resubmits to admin)
router.put("/:id", auth, upload.single("document"), async (req, res) => {
  try {
    const { githubLink, notes } = req.body
    const submission = await TaskSubmission.findById(req.params.id)
      .populate("task", "title status")

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" })
    }

    // Check if user is still active
    const user = await User.findOne({ _id: submission.user, stillExist: 1 });
    if (!user) {
      return res.status(404).json({ error: "User not found or no longer active" });
    }

    let documentLink = submission.documentLink
    let fileType = submission.fileType
    if (req.file) {
      console.log("File uploaded:", {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      })

      const cloudinaryUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname)
      documentLink = cloudinaryUrl
      fileType = req.file.mimetype
    }

    // Store old status before update for tracking
    const previousStatus = submission.status

    // Update submission and reset status to Pending for admin review (resubmission)
    const updatedSubmission = await TaskSubmission.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          githubLink: githubLink || "",
          notes: notes || "",
          documentLink,
          fileType,
          status: "Pending", // Reset to Pending for admin to review again
          resubmittedAt: Date.now(), // Track when it was resubmitted
          updatedAt: Date.now(),
        },
      },
      { new: true }
    )
      .populate("task", "title status")
      .populate("user", "name email")
      .populate("reviewHistory.reviewedBy", "name email")

    // Workflow: repo resubmissions go to Tester first; others continue to Admin
    const hasRepo = !!(updatedSubmission.githubLink && String(updatedSubmission.githubLink).trim())
    const recipients = hasRepo
      ? await User.find({ role: "Tester", stillExist: 1 })
      : await User.find({ role: "Admin", stillExist: 1 })
    const notificationTitle = hasRepo ? "Repo Resubmitted for Testing" : "Task Resubmitted"
    const taskTitle = submission.task?.title || "Unknown Task"
    
    for (const recipient of recipients) {
      await Notification.create({
        recipient: recipient._id,
        type: "task_resubmitted",
        title: notificationTitle,
        message: `${user.name} has resubmitted their work for task: '${taskTitle}'. Please review the updated submission.`,
        task: submission.task?._id,
      })
    }

    console.log(`✅ Submission ${req.params.id} updated and resubmitted by ${user.name}`)

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("submission-resubmitted", {
        submission: updatedSubmission,
        previousStatus,
        resubmittedBy: user.name,
      })
    }

    // Phase 1: Trigger PARIKSHAK Review asynchronously on resubmission
    let traceId = req.headers["x-trace-id"] || `trace_resub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    invokeParikshak(updatedSubmission._id, traceId, req.io).catch(err => {
      console.error("[PARIKSHAK] Uncaught error triggering review on resubmission:", err);
    });

    res.json(updatedSubmission)
  } catch (error) {
    console.error("Error updating submission:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Review submission
router.put("/:id/review", auth, async (req, res) => {
  try {
    const { status, feedback, reviewedBy } = req.body

    if (!status || !["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" })
    }

    // Get or generate trace_id (make it optional for backward compatibility)
    let traceId = req.headers["x-trace-id"];
    if (!traceId) {
      traceId = `trace_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      console.log(`[TRACE_WARNING] Auto-generated trace_id for submission review`);
    } else {
      console.log(`[TRACE_RECEIVED] Review received - trace_id=${traceId}, status=${status}`);
    }

    const submission = await TaskSubmission.findById(req.params.id)
    if (!submission) {
      return res.status(404).json({ error: "Submission not found" })
    }

    // Check if user is still active
    const user = await User.findOne({ _id: submission.user, stillExist: 1 });
    if (!user) {
      return res.status(404).json({ error: "User not found or no longer active" });
    }

    // Use reviewedBy from request body, or fall back to user ID from token
    const reviewerId = reviewedBy || req.user.id
    if (!reviewerId) {
      return res.status(400).json({ error: "Reviewer ID is required" })
    }

    // Add current review to history
    if (submission.status !== "Pending") {
      submission.reviewHistory.push({
        status: submission.status,
        feedback: submission.feedback,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
    }

    // Update current status and feedback
    submission.status = status
    submission.feedback = feedback || ""
    await submission.save()

    const task = await Task.findById(submission.task);

    // Emit execution events based on review outcome
    let execContext;
    try {
      if (status === "Approved") {
        execContext = await emitTaskCompletedEvent(submission, traceId, task?.branch);
        console.log(`[TRACE_EMITTED] Task completed - trace_id=${execContext.traceId}`);
        
        // Mark task as completed
        if (task && task.status !== "Completed") {
          task.status = "Completed"
          task.progress = 100
          await task.save()
        }
      } else if (status === "Rejected") {
        execContext = await emitTaskFailedEvent(
          submission, 
          feedback || "submission_rejected", 
          traceId, 
          task?.branch
        );
        console.log(`[TRACE_EMITTED] Task failed - trace_id=${execContext.traceId}`);
      }
    } catch (execErr) {
      console.error("[TRACE_FAILURE] Failed to emit review event:", execErr);
    }

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("submission-reviewed", {
        submission,
        trace_id: execContext?.traceId
      })
    }

    // Notify the submitter
    await Notification.create({
      recipient: submission.user,
      type: "submission_reviewed",
      title: `Submission ${status}`,
      message: `Your submission for task '${submission.task.title}' has been ${status.toLowerCase()}. Feedback: ${feedback || "None"}`,
      task: submission.task,
    })

    res.json({
      ...submission.toObject(),
      trace_id: execContext?.traceId,
      execution_id: execContext?.executionId
    })
  } catch (error) {
    console.error("Error reviewing submission:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Delete submission
router.delete("/:id", auth, async (req, res) => {
  try {
    const submission = await TaskSubmission.findById(req.params.id)

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" })
    }

    await TaskSubmission.findByIdAndDelete(req.params.id)

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("submission-deleted", req.params.id)
    }

    res.json({ message: "Submission deleted successfully" })
  } catch (error) {
    console.error("Error deleting submission:", error)
    res.status(500).json({ error: "Server error" })
  }
})

module.exports = router