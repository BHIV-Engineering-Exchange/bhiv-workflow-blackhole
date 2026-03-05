const express = require("express")
const router = express.Router()
const Task = require("../models/Task")
const User = require("../models/User")
const Department = require("../models/Department")
const Aim = require("../models/Aim")
const Progress = require("../models/Progress")
const DailyAttendance = require("../models/DailyAttendance")
const auth = require("../middleware/auth")
const { branchFilter } = require("../middleware/branchMiddleware")

// Helper to get branch filter from request
const getBranchQuery = (req) => {
  const selectedBranch = req.headers['x-branch'] || req.query.branch;
  if (selectedBranch && selectedBranch !== 'all') {
    return { branch: selectedBranch };
  }
  return {};
};

// Get dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const branchQuery = getBranchQuery(req);
    
    // Get task counts by status
    const totalTasks = await Task.countDocuments(branchQuery)
    const completedTasks = await Task.countDocuments({ ...branchQuery, status: "Completed" })
    const inProgressTasks = await Task.countDocuments({ ...branchQuery, status: "In Progress" })
    const pendingTasks = await Task.countDocuments({ ...branchQuery, status: "Pending" })
 
 
    // Get change percentages (mock data - in a real app, you'd compare with historical data)
    const totalTasksChange = 12 // +12% from last month
    const completedTasksChange = 8 // +8% from last month
    const inProgressTasksChange = 2 // +2 tasks since yesterday
    const pendingTasksChange = -2 // -2 tasks since yesterday

    res.json({
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      totalTasksChange,
      completedTasksChange,
      inProgressTasksChange,
      pendingTasksChange,
    })
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Get department stats
router.get("/departments", async (req, res) => {
  try {
    const branchQuery = getBranchQuery(req);
    const departments = await Department.find().sort({ name: 1 })

    // For each department, get task counts
    const departmentStats = await Promise.all(
      departments.map(async (department) => {
        const totalTasks = await Task.countDocuments({ ...branchQuery, department: department._id })
        const completedTasks = await Task.countDocuments({
          ...branchQuery,
          department: department._id,
          status: "Completed",
        })

        return {
          id: department._id,
          name: department.name,
          color: department.color || "bg-blue-500",
          total: totalTasks,
          completed: completedTasks,
        }
      }),
    )

    res.json(departmentStats)
  } catch (error) {
    console.error("Error fetching department stats:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Get tasks overview
router.get("/tasks-overview", async (req, res) => {
  try {
    const branchQuery = getBranchQuery(req);
    
    // Get task counts by status
    const completedCount = await Task.countDocuments({ ...branchQuery, status: "Completed" })
    const inProgressCount = await Task.countDocuments({ ...branchQuery, status: "In Progress" })
    const pendingCount = await Task.countDocuments({ ...branchQuery, status: "Pending" })

    // Get task counts by priority
    const highPriorityCount = await Task.countDocuments({ ...branchQuery, priority: "High" })
    const mediumPriorityCount = await Task.countDocuments({ ...branchQuery, priority: "Medium" })
    const lowPriorityCount = await Task.countDocuments({ ...branchQuery, priority: "Low" })

    const statusData = [
      { name: "Completed", value: completedCount, color: "#22c55e" },
      { name: "In Progress", value: inProgressCount, color: "#3b82f6" },
      { name: "Pending", value: pendingCount, color: "#f59e0b" },
    ]

    const priorityData = [
      { name: "High", value: highPriorityCount, color: "#ef4444" },
      { name: "Medium", value: mediumPriorityCount, color: "#f59e0b" },
      { name: "Low", value: lowPriorityCount, color: "#22c55e" },
    ]

    res.json({
      statusData,
      priorityData,
    })
  } catch (error) {
    console.error("Error fetching tasks overview:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Get recent activity
router.get("/activity", async (req, res) => {
  try {
    // In a real app, you'd have an Activity model to track user actions
    // For this example, we'll return mock data
    const activities = [
      {
        id: 1,
        user: {
          name: "John Doe",
          avatar: "/placeholder.svg?height=40&width=40",
          initials: "JD",
        },
        action: "completed",
        task: "Q1 Marketing Campaign Planning",
        department: "Marketing",
        time: "2 hours ago",
      },
      {
        id: 2,
        user: {
          name: "Jane Smith",
          avatar: "/placeholder.svg?height=40&width=40",
          initials: "JS",
        },
        action: "updated",
        task: "Sales Presentation for Client XYZ",
        department: "Sales",
        time: "3 hours ago",
      },
      {
        id: 3,
        user: {
          name: "Mike Johnson",
          avatar: "/placeholder.svg?height=40&width=40",
          initials: "MJ",
        },
        action: "created",
        task: "Inventory Management System Update",
        department: "Operations",
        time: "5 hours ago",
      },
      {
        id: 4,
        user: {
          name: "Sarah Williams",
          avatar: "/placeholder.svg?height=40&width=40",
          initials: "SW",
        },
        action: "assigned",
        task: "Customer Feedback Analysis",
        department: "Marketing",
        time: "6 hours ago",
      },
      {
        id: 5,
        user: {
          name: "Alex Brown",
          avatar: "/placeholder.svg?height=40&width=40",
          initials: "AB",
        },
        action: "commented on",
        task: "Supply Chain Optimization",
        department: "Operations",
        time: "8 hours ago",
      },
    ]

    res.json(activities)
  } catch (error) {
    console.error("Error fetching recent activity:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Get user stats
router.get("/user-stats/:userId", async (req, res) => {
    try {
      let userId = req.params.userId.trim(); // 👉 remove spaces/newlines
      console.log('user id in backend for userstats', userId);
  
      const totalTasks = await Task.countDocuments({ assignee: userId });
      const completedTasks = await Task.countDocuments({ assignee: userId, status: "Completed" });
      const inProgressTasks = await Task.countDocuments({ assignee: userId, status: "In Progress" });
      const pendingTasks = await Task.countDocuments({ assignee: userId, status: "Pending" });
  
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
  
      const upcomingDeadlines = await Task.find({
        assignee: userId,
        dueDate: { $gte: today, $lte: nextWeek },
        status: { $ne: "Completed" },
      })
      .sort({ dueDate: 1 })
      .limit(5)
      .populate("department", "name color");
  
      res.json({
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        completionRate,
        upcomingDeadlines,
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Server error" });
    }
  });
  
// @route   GET api/dashboard/progress-stats
// @desc    Get progress statistics
// @access  Private
router.get("/progress-stats", auth, async (req, res) => {
  try {
    // Get tasks with due dates in the future
    const now = new Date();
    const upcomingTasks = await Task.find({
      dueDate: { $gt: now },
      status: { $ne: "Completed" },
    }).populate("assignee", "name");
    
    // Calculate progress statistics
    const progressStats = upcomingTasks.map(task => {
      const totalDays = Math.ceil((new Date(task.dueDate) - new Date(task.createdAt)) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.ceil((now - new Date(task.createdAt)) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.ceil((new Date(task.dueDate) - now) / (1000 * 60 * 60 * 24));
      
      // Calculate expected progress based on time elapsed
      const expectedProgress = Math.min(100, Math.round((daysElapsed / totalDays) * 100));
      
      // Calculate progress difference (actual vs expected)
      const progressDifference = task.progress - expectedProgress;
      
      return {
        id: task._id,
        title: task.title,
        assignee: task.assignee?.name || "Unassigned",
        dueDate: task.dueDate,
        actualProgress: task.progress,
        expectedProgress,
        progressDifference,
        daysRemaining,
        totalDays,
        status: progressDifference >= 0 ? "On Track" : "Behind Schedule",
      };
    });
    
    res.json(progressStats);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET api/dashboard/admin-report
// @desc    Get comprehensive admin report with date filtering
// @access  Admin or Manager
router.get("/admin-report", auth, async (req, res) => {
  try {
    // Check if user is Admin or Manager
    if (req.user.role !== "Admin" && req.user.role !== "Manager") {
      return res.status(403).json({ error: "Access denied. Admin or Manager only." });
    }

    const { date, filter } = req.query;
    
    // Determine filter type (today, yesterday, weekly, lifetime)
    const filterType = filter || (date ? 'today' : 'lifetime');
    
    // Parse date or use today
    let targetDate = new Date();
    let dateRangeStart = null;
    let dateRangeEnd = null;
    
    if (filterType === 'today') {
      targetDate = new Date();
      targetDate.setHours(0, 0, 0, 0);
      dateRangeStart = targetDate;
      dateRangeEnd = new Date(targetDate);
      dateRangeEnd.setDate(dateRangeEnd.getDate() + 1);
    } else if (filterType === 'yesterday') {
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - 1);
      targetDate.setHours(0, 0, 0, 0);
      dateRangeStart = targetDate;
      dateRangeEnd = new Date(targetDate);
      dateRangeEnd.setDate(dateRangeEnd.getDate() + 1);
    } else if (filterType === 'weekly') {
      targetDate = new Date();
      targetDate.setHours(0, 0, 0, 0);
      dateRangeStart = new Date(targetDate);
      dateRangeStart.setDate(targetDate.getDate() - targetDate.getDay());
      dateRangeEnd = new Date(dateRangeStart);
      dateRangeEnd.setDate(dateRangeEnd.getDate() + 7);
    } else if (filterType === 'monthly') {
      targetDate = new Date();
      targetDate.setHours(0, 0, 0, 0);
      dateRangeStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
      dateRangeEnd.setHours(0, 0, 0, 0);
      // Set targetDate to start of month for consistency with other queries
      targetDate = dateRangeStart;
    } else if (filterType === 'lifetime') {
      // No date filter for lifetime
      dateRangeStart = null;
      dateRangeEnd = null;
    } else if (date) {
      targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      dateRangeStart = targetDate;
      dateRangeEnd = new Date(targetDate);
      dateRangeEnd.setDate(dateRangeEnd.getDate() + 1);
    }
    
    const nextDay = dateRangeEnd || new Date();

    // 1. Main Admin Dashboard Stats
    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: "Completed" });
    const inProgressTasks = await Task.countDocuments({ status: "In Progress" });
    const pendingTasks = await Task.countDocuments({ status: "Pending" });
    const totalUsers = await User.countDocuments({ stillExist: 1 });
    const totalDepartments = await Department.countDocuments();

    // 2. Department-wise Task Count
    const departments = await Department.find().sort({ name: 1 });
    const departmentTaskCounts = await Promise.all(
      departments.map(async (dept) => {
        const totalTasks = await Task.countDocuments({ department: dept._id });
        const completedTasks = await Task.countDocuments({
          department: dept._id,
          status: "Completed",
        });
        const inProgressTasks = await Task.countDocuments({
          department: dept._id,
          status: "In Progress",
        });
        const pendingTasks = await Task.countDocuments({
          department: dept._id,
          status: "Pending",
        });

        return {
          id: dept._id,
          name: dept.name,
          color: dept.color || "bg-blue-500",
          totalTasks,
          completedTasks,
          inProgressTasks,
          pendingTasks,
        };
      })
    );

    // 3. All Users with Aims and Time
    const users = await User.find({ stillExist: 1 })
      .populate("department", "name")
      .select("name email role department");
    
    const usersWithAims = await Promise.all(
      users.map(async (user) => {
        const aim = await Aim.findOne({
          user: user._id,
          date: {
            $gte: targetDate,
            $lt: nextDay,
          },
        });

        return {
          userId: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department?.name || "No Department",
          aim: aim ? {
            aims: aim.aims,
            completionStatus: aim.completionStatus,
            progressPercentage: aim.progressPercentage || 0,
            workSessionInfo: aim.workSessionInfo || null,
            createdAt: aim.createdAt,
          } : null,
        };
      })
    );

    // 4. User Count
    const userCount = users.length;

    // 5. Zero Task Employees (with ability to assign tasks)
    const usersWithTaskCounts = await Promise.all(
      users.map(async (user) => {
        const taskCount = await Task.countDocuments({
          assignee: user._id,
          status: { $ne: "Completed" },
        });
        return {
          userId: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department?.name || "No Department",
          taskCount,
        };
      })
    );

    const zeroTaskEmployees = usersWithTaskCounts
      .filter((u) => u.taskCount === 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    // 6. Each User Progress Update (for the selected date)
    const progressUpdates = await Progress.find({
      date: {
        $gte: targetDate,
        $lt: nextDay,
      },
    })
      .populate("user", "name email role")
      .populate("task", "title status")
      .sort({ createdAt: -1 });

    // Some progress records might have missing or deleted users/tasks.
    // Guard against null references so the report doesn't crash.
    const userProgressUpdates = progressUpdates
      .filter((progress) => progress.user) // keep only records with a valid user
      .map((progress) => ({
        id: progress._id,
        userId: progress.user?._id,
        userName: progress.user?.name || "Unknown User",
        userEmail: progress.user?.email || "",
        taskId: progress.task?._id || null,
        taskTitle: progress.task?.title || "General Progress",
        progressPercentage: progress.progressPercentage,
        notes: progress.notes,
        blockers: progress.blockers,
        achievements: progress.achievements,
        date: progress.date,
        createdAt: progress.createdAt,
      }));

    // 7. Users who Started Day with Work Hours
    let dailyAttendances;
    if (dateRangeStart && dateRangeEnd) {
      dailyAttendances = await DailyAttendance.find({
      date: {
          $gte: dateRangeStart,
          $lt: dateRangeEnd,
      },
      startDayTime: { $exists: true },
    })
      .populate("user", "name email role department")
      .sort({ startDayTime: 1 });
    } else {
      // Lifetime: get all attendances
      dailyAttendances = await DailyAttendance.find({
        startDayTime: { $exists: true },
      })
        .populate("user", "name email role department")
        .sort({ startDayTime: 1 });
    }

    let usersWithStartDay;
    
    // For weekly, monthly, and lifetime, aggregate hours by user and include all users
    if (filterType === 'weekly' || filterType === 'monthly' || filterType === 'lifetime') {
      // Get all active users first
      const allUsers = await User.find({ stillExist: 1 })
        .populate("department", "name")
        .select("name email role department");
      
      const userHoursMap = new Map();
      
      // Initialize all users with 0 hours
      allUsers.forEach((user) => {
        const userId = user._id.toString();
        userHoursMap.set(userId, {
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          department: user.department?.name || "No Department",
          totalHoursWorked: 0,
        });
      });
      
      // Add hours from attendances
      dailyAttendances.forEach((attendance) => {
        if (!attendance.user) return;

        const userId = attendance.user._id.toString();
        
        if (userHoursMap.has(userId)) {
          const userData = userHoursMap.get(userId);
          userData.totalHoursWorked += attendance.totalHoursWorked || 0;
        }
      });

      usersWithStartDay = Array.from(userHoursMap.values());
    } else {
      // Today or Yesterday: individual records
      usersWithStartDay = dailyAttendances
        .filter((attendance) => attendance.user) // skip records with missing user
        .map((attendance) => ({
          userId: attendance.user._id,
          userName: attendance.user.name,
          userEmail: attendance.user.email,
          userRole: attendance.user.role,
          department: attendance.user.department?.name || "No Department",
          startDayTime: attendance.startDayTime,
          endDayTime: attendance.endDayTime || null,
          totalHoursWorked: attendance.totalHoursWorked || 0,
          regularHours: attendance.regularHours || 0,
          overtimeHours: attendance.overtimeHours || 0,
          status: attendance.status,
          workLocationType: attendance.workLocationType || "Office",
        }));
    }

    const usersWithStartDayCount = usersWithStartDay.length;

    res.json({
      date: targetDate.toISOString().split("T")[0],
      dashboardStats: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        totalUsers,
        totalDepartments,
      },
      departmentTaskCounts,
      usersWithAims,
      userCount,
      zeroTaskEmployees,
      userProgressUpdates,
      usersWithStartDay,
      usersWithStartDayCount,
    });
  } catch (error) {
    console.error("Error generating admin report:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router
