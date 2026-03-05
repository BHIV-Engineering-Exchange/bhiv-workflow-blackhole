// const express = require("express")
// const router = express.Router()
// const auth = require("../middleware/auth")
// const adminAuth = require("../middleware/adminAuth")
// const Task = require("../models/Task")
// const User = require("../models/User")
// const Department = require("../models/Department")
// const Progress = require("../models/Progress")
// const {
//   sendTaskReminder,
//   generateDepartmentProgressPDF,
//   sendDepartmentProgressReport,
//   sendAimReminder,
// } = require("../utils/emailService")

// // @route   POST api/notifications/broadcast-reminders
// // @desc    Broadcast progress update reminders to all users with active tasks
// // @access  Private (Admin only)
// router.post("/broadcast-reminders", async (req, res) => {
//   try {
//     // Get all active tasks (not completed)
//     const tasks = await Task.find({ status: { $ne: "Completed" } })
//       .populate("assignee", "name email")
//       .populate("department", "name")

//     if (tasks.length === 0) {
//       return res.status(404).json({ msg: "No active tasks found" })
//     }

//     const emailPromises = []
//     const emailsSent = []

//     // Send email for each task
//     for (const task of tasks) {
//       if (!task.assignee) continue

//       emailPromises.push(
//         sendTaskReminder(task.assignee, task)
//           .then(() => {
//             emailsSent.push({
//               user: task.assignee.name,
//               email: task.assignee.email,
//               task: task.title,
//             })
//           })
//           .catch((error) => {
//             console.error(`Failed to send email to ${task.assignee.email}:`, error)
//           }),
//       )
//     }

//     await Promise.all(emailPromises)

//     res.json({
//       msg: `Sent ${emailsSent.length} reminder emails`,
//       emails: emailsSent,
//     })
//   } catch (err) {
//     console.error(err.message)
//     res.status(500).send("Server Error")
//   }
// })

// // @route   POST api/notifications/broadcast-aim-reminders
// // @desc    Broadcast aim setting reminders to all users
// // @access  Private (Admin only)
// router.post("/broadcast-aim-reminders", async (req, res) => {
//   try {
//     // Get all active users
//     const users = await User.find({ role: { $ne: "Admin" } })
//       .populate("department", "name")

//     if (users.length === 0) {
//       return res.status(404).json({ msg: "No users found" })
//     }

//     const emailPromises = []
//     const emailsSent = []

//     // Send email for each user
//     for (const user of users) {
//       emailPromises.push(
//         sendAimReminder(user)
//           .then(() => {
//             emailsSent.push({
//               user: user.name,
//               email: user.email,
//             })
//           })
//           .catch((error) => {
//             console.error(`Failed to send email to ${user.email}:`, error)
//           }),
//       )
//     }

//     await Promise.all(emailPromises)

//     res.json({
//       msg: `Sent ${emailsSent.length} aim reminder emails`,
//       emails: emailsSent,
//     })
//   } catch (err) {
//     console.error(err.message)
//     res.status(500).send("Server Error")
//   }
// })

// // @route   POST api/notifications/generate-reports/:id
// // @desc    Generate and email department progress reports
// // @access  Private (Admin only)
// router.post("/generate-reports/:id", async (req, res) => {
//   try {
//     // Get all departments
//     const departments = await Department.find()
//     if (departments.length === 0) {
//       return res.status(404).json({ msg: "No departments found" })
//     }

//     const reportsSent = []

//     // Generate and send report for each department
//     for (const department of departments) {
//       // Get all tasks for this department
//       const tasks = await Task.find({ department: department._id })

//       // Get all users in this department
//       const users = await User.find({ department: department._id })

//       // Get progress data for all users in this department
//       const progressData = {}

//       // Fetch progress data for each user
//       for (const user of users) {
//         const userProgress = await Progress.find({ user: user._id }).sort({ date: -1 }).limit(30) // Get last 30 progress entries per user

//         progressData[user._id] = userProgress
//       }

//       // Generate PDF report with progress data
//       const pdfPath = await generateDepartmentProgressPDF(department, tasks, users, progressData)

//       const admin = await User.findById(req.params.id);
//       if (!admin || !admin.email) {
//         return res.status(404).json({ msg: "Admin user not found or missing email" });
//       }
//       await sendDepartmentProgressReport(admin, department, pdfPath);

//       reportsSent.push({
//         department: department.name,
//         taskCount: tasks.length,
//         userCount: users.length,
//         progressEntriesAnalyzed: Object.values(progressData).reduce((sum, entries) => sum + entries.length, 0),
//       })
//     }

//     res.json({
//       msg: `Generated and sent ${reportsSent.length} department reports`,
//       reports: reportsSent,
//     })
//   } catch (err) {
//     console.error(err.message)
//     res.status(500).send("Server Error")
//   }
// })

const express = require("express")
const router = express.Router()
const nodemailer = require("nodemailer")
const Task = require("../models/Task")
const User = require("../models/User")
const Aim = require("../models/Aim")
const MonitoringAlert = require("../models/MonitoringAlert")
const { sendPushNotificationToUsers, broadcastPushNotification } = require("../utils/pushNotificationService")

// Helper to get branch filter from request headers
const getBranchQuery = (req) => {
  const selectedBranch = req.headers['x-branch'] || req.query.branch;
  if (selectedBranch && selectedBranch !== 'all') {
    return { branch: selectedBranch };
  }
  return {};
};

// Nodemailer transporter setup (replace with your email service details)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

// Route to broadcast task reminders with monitoring alerts - FILTERED BY BRANCH
router.post("/broadcast-reminders", async (req, res) => {
  try {
    const branchQuery = getBranchQuery(req);
    // Find only pending tasks - explicitly exclude "Completed" and "In Progress"
    // Query with exact enum value first, then filter to ensure only pending tasks - FILTERED BY BRANCH
    const allTasks = await Task.find({
      status: { $ne: "Completed" },  // Exclude completed tasks
      ...branchQuery
    }).populate("assignee", "email name _id")

    // Filter to get ONLY pending tasks (exclude "In Progress" and any other statuses)
    const pendingTasks = allTasks.filter(task => {
      if (!task.status) return false
      const status = task.status.trim()
      // Only include tasks with status exactly "Pending" (case-sensitive as per enum)
      return status === "Pending"
    })

    if (!pendingTasks || pendingTasks.length === 0) {
      return res.status(200).send({ 
        message: "No pending tasks found.", 
        alertsCreated: 0,
        usersNotified: 0,
        emails: [] 
      })
    }

    // Get io instance from request
    const io = req.io

    if (!io) {
      console.warn('⚠️ Socket.io instance not available in request')
    }

    // Create monitoring alerts for each user with pending tasks
    const alertPromises = []
    const userAlerts = new Map() // Track alerts per user

    console.log(`📊 Found ${pendingTasks.length} pending tasks`)

    for (const task of pendingTasks) {
      // Ensure task has assignee and assignee has _id
      if (task.assignee && task.assignee._id) {
        const userId = task.assignee._id.toString()
        
        // Group tasks by user
        if (!userAlerts.has(userId)) {
          userAlerts.set(userId, {
            user: task.assignee,
            tasks: []
          })
        }
        userAlerts.get(userId).tasks.push(task)
      } else {
        console.warn(`⚠️ Task ${task._id} (${task.title}) has no assignee, skipping`)
      }
    }

    // Check if we have any users with tasks
    if (userAlerts.size === 0) {
      return res.status(200).send({ 
        message: "No pending tasks found with valid assignees.", 
        alertsCreated: 0,
        usersNotified: 0,
        emails: [] 
      })
    }

    console.log(`👥 Grouped tasks for ${userAlerts.size} users`)

    // Create one alert per user with all their incomplete tasks
    for (const [userId, data] of userAlerts) {
      const taskCount = data.tasks.length
      
      // Show first 5 task titles, then indicate if there are more
      const maxTasksToShow = 5
      const tasksToShow = data.tasks.slice(0, maxTasksToShow)
      const remainingCount = taskCount - maxTasksToShow
      const taskTitles = tasksToShow.map(t => t.title).join(", ")
      const taskListText = remainingCount > 0 
        ? `${taskTitles}, and ${remainingCount} more task${remainingCount > 1 ? 's' : ''}`
        : taskTitles
      
      // Create monitoring alert for task reminder
      const alertPromise = MonitoringAlert.createAlert({
        employee: userId,
        alert_type: 'task_reminder',
        severity: taskCount > 3 ? 'high' : taskCount > 1 ? 'medium' : 'low',
        title: '⚠️ Task Completion Reminder',
        description: `You have ${taskCount} pending task${taskCount > 1 ? 's' : ''} that need${taskCount === 1 ? 's' : ''} your attention. Please complete: ${taskListText}`,
        data: {
          reminder_type: 'task_reminder',
          task_count: taskCount,
          task_ids: data.tasks.map(t => t._id),
          action_url: '/tasks'
        },
        status: 'active',
        auto_generated: true,
        notification_sent: true,
        notification_channels: ['dashboard']
      })
      
      alertPromises.push(alertPromise)

      // Emit socket event for real-time alert in header
      if (io) {
        alertPromise.then((alert) => {
          const alertData = {
            _id: alert._id,
            title: alert.title,
            description: alert.description,
            severity: alert.severity,
            alert_type: alert.alert_type,
            timestamp: alert.timestamp,
            status: alert.status,
            employee: alert.employee
          }
          
          io.to(`user_${userId}`).emit('monitoring-alert', alertData)
          console.log(`📢 Task reminder alert emitted to user ${userId}:`, alertData)
        }).catch(err => {
          console.error(`Failed to emit task reminder alert to user ${userId}:`, err)
        })
      } else {
        console.warn('⚠️ Socket.io instance not available for task reminders')
      }
    }

    // Wait for all alerts to be created
    const createdAlerts = await Promise.all(alertPromises)

    // Send push notifications
    try {
      const pushResult = await broadcastPushNotification(
        "⚠️ Task Completion Reminder",
        "You have incomplete tasks that need your attention. Check your alerts!",
        "/tasks",
        "task-reminder",
      )

      console.log(`Push notifications sent: ${pushResult.successful} successful, ${pushResult.failed} failed`)
    } catch (pushError) {
      console.error("Error sending push notifications:", pushError)
    }

    res.status(200).send({ 
      message: `Pending task reminder alerts sent successfully to ${userAlerts.size} users.`,
      alertsCreated: createdAlerts.length,
      usersNotified: userAlerts.size,
      emails: [] // No emails sent, only alerts
    })
  } catch (error) {
    console.error("Error broadcasting task reminders:", error)
    res.status(500).send({ message: "Error broadcasting task reminders.", error: error.message })
  }
})

// Route to broadcast daily aims reminders with monitoring alerts - FILTERED BY BRANCH
router.post("/broadcast-aim-reminders", async (req, res) => {
  try {
    const branchQuery = getBranchQuery(req);
    // Fetch all users (excluding admins) - FILTERED BY BRANCH
    const users = await User.find({
      role: { $ne: "Admin" },
      ...branchQuery
    })

    if (!users || users.length === 0) {
      return res.status(200).send({ 
        message: "No users found.",
        alertsCreated: 0,
        usersNotified: 0,
        emails: []
      })
    }

    // Get io instance from request
    const io = req.io

    // Create monitoring alerts for each user
    const alertPromises = []

    for (const user of users) {
      const userId = user._id.toString()
      
      // Create monitoring alert for aim reminder
      const alertPromise = MonitoringAlert.createAlert({
        employee: userId,
        alert_type: 'aim_reminder',
        severity: 'medium',
        title: '🎯 Set Your Daily Aims',
        description: 'Please set your daily aims for today to track your progress and goals.',
        data: {
          reminder_type: 'daily_aims',
          action_url: '/aims'
        },
        status: 'active',
        auto_generated: true,
        notification_sent: true,
        notification_channels: ['dashboard']
      })
      
      alertPromises.push(alertPromise)

      // Emit socket event for real-time alert in header
      if (io) {
        alertPromise.then((alert) => {
          const alertData = {
            _id: alert._id,
            title: alert.title,
            description: alert.description,
            severity: alert.severity,
            alert_type: alert.alert_type,
            timestamp: alert.timestamp,
            status: alert.status,
            employee: alert.employee
          }
          
          io.to(`user_${userId}`).emit('monitoring-alert', alertData)
          console.log(`📢 Aim reminder alert emitted to user ${userId}:`, alertData)
        }).catch(err => {
          console.error(`Failed to emit aim reminder alert to user ${userId}:`, err)
        })
      } else {
        console.warn('⚠️ Socket.io instance not available for aim reminders')
      }
    }

    // Wait for all alerts to be created
    const createdAlerts = await Promise.all(alertPromises)

    // Send push notifications
    try {
      const pushResult = await broadcastPushNotification(
        "🎯 Set Your Daily Aims",
        "Don't forget to set your aims for today!",
        "/aims",
        "aim-reminder",
      )

      console.log(
        `Aim reminder push notifications sent: ${pushResult.successful} successful, ${pushResult.failed} failed`,
      )
    } catch (pushError) {
      console.error("Error sending aim reminder push notifications:", pushError)
    }

    res.status(200).send({ 
      message: `Aim reminder alerts sent successfully to ${users.length} users.`,
      alertsCreated: createdAlerts.length,
      usersNotified: users.length,
      emails: [] // No emails sent, only alerts
    })
  } catch (error) {
    console.error("Error broadcasting daily aims reminders:", error)
    res.status(500).send({ message: "Error broadcasting daily aims reminders.", error: error.message })
  }
})

// @route   POST api/notifications/toggle-automation
// @desc    Toggle automation settings for reminders
// @access  Private (Admin only)
router.post("/toggle-automation", async (req, res) => {
  try {
    const { automateAimReminders, automateProgressReminders } = req.body;
    
    // In a real implementation, you would save these settings to a database
    // For now, we'll just return success
    console.log("Automation settings updated:", { automateAimReminders, automateProgressReminders });
    
    res.json({
      success: true,
      msg: "Automation settings updated successfully",
      settings: {
        automateAimReminders,
        automateProgressReminders
      }
    });
  } catch (err) {
    console.error("Toggle automation error:", err.message);
    res.status(500).json({ success: false, error: "Server Error" });
  }
});

module.exports = router

