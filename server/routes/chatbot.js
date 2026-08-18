const express = require('express');
const router = express.Router();
const uniguruAIService = require('../services/uniguruAIService');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Task = require('../models/Task');
const Department = require('../models/Department');
const Attendance = require('../models/Attendance');
const DailyAttendance = require('../models/DailyAttendance');
const Aim = require('../models/Aim');
const AIReview = require('../models/AIReview');
const SalaryAttendance = require('../models/SalaryAttendance');

// Store conversation history
const conversationHistory = new Map();

/**
 * Chat endpoint for admin chatbot
 * POST /api/chatbot/chat
 */
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user.id;

    console.log('🤖 Chatbot request from user:', userId);
    console.log('💬 User message:', message);

    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'Admin') {
      console.log('❌ Access denied - user is not admin:', user?.role);
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    console.log('✅ Admin verified:', user.email);

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check for user-specific or department-specific queries
    const userQuery = detectUserQuery(message);
    const deptQuery = detectDepartmentQuery(message);
    let additionalContext = '';

    if (userQuery) {
      console.log('🔍 User-specific query detected:', userQuery);
      const userAnalysis = await analyzeUserByName(userQuery);
      
      if (userAnalysis.found) {
        additionalContext = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIFIC USER ANALYSIS FOR "${userAnalysis.user.name}":
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 PROFILE:
   • Name: ${userAnalysis.user.name}
   • Role: ${userAnalysis.user.role}
   • Department: ${userAnalysis.user.department}
   • Employee ID: ${userAnalysis.user.employeeId}
   • Email: ${userAnalysis.user.email}
   • Hourly Rate: $${userAnalysis.user.hourlyRate}/hour
   • Status: ${userAnalysis.user.status}

📋 TASK PERFORMANCE:
   • Total Tasks: ${userAnalysis.tasks.total}
   • Completed: ${userAnalysis.tasks.completed} (${userAnalysis.tasks.completionRate}%)
   • In Progress: ${userAnalysis.tasks.inProgress}
   • Pending: ${userAnalysis.tasks.pending}
   • Overdue: ${userAnalysis.tasks.overdue}
   • Average Completion Time: ${userAnalysis.tasks.avgCompletionTime} days
   
   Recent Tasks:
${userAnalysis.tasks.recentTasks.map(t => `   • "${t.title}" - ${t.status} (${t.priority} priority)`).join('\n')}

📅 ATTENDANCE (Last 30 days):
   • Days Present: ${userAnalysis.attendance.daysPresent}/${userAnalysis.attendance.workingDays}
   • Attendance Rate: ${userAnalysis.attendance.attendanceRate}%
   • Total Hours Worked: ${Math.round(userAnalysis.attendance.totalHours)} hours
   • Average Hours/Day: ${userAnalysis.attendance.avgHoursPerDay} hours
   • Overtime: ${Math.round(userAnalysis.attendance.overtimeHours)} hours
   • Issues: ${userAnalysis.attendance.lateArrivals} late/discrepancies

🎯 AIMS & GOALS:
   • Total: ${userAnalysis.aims.total}
   • Completed: ${userAnalysis.aims.completed} (${userAnalysis.aims.completionRate}%)
   • Recent Aim: "${userAnalysis.aims.recentAim}"

🤖 PERFORMANCE SCORES:
   • Total Reviews: ${userAnalysis.performance.totalReviews}
   • Average Score: ${userAnalysis.performance.avgScore}/100
   ${userAnalysis.performance.recentReview ? `• Latest Review: ${userAnalysis.performance.recentReview.score}/100 - "${userAnalysis.performance.recentReview.comment}"` : ''}

💰 SALARY (Current Month):
   ${userAnalysis.salary ? `• Adjusted Salary: $${userAnalysis.salary.adjustedSalary}
   • Based on ${userAnalysis.salary.totalHours} hours worked
   • Days Present: ${userAnalysis.salary.daysPresent}` : 'No salary data available for current month'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: Use this detailed user data to answer accurately. Provide specific numbers and insights from above.
`;
      } else {
        additionalContext = `\n\nNOTE: User "${userQuery}" was not found in the system.`;
      }
    } else if (deptQuery) {
      console.log('🏢 Department-specific query detected:', deptQuery);
      const deptAnalysis = await analyzeDepartmentByName(deptQuery);
      
      if (deptAnalysis.found) {
        additionalContext = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPARTMENT ANALYSIS FOR "${deptAnalysis.department.name}":
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏢 DEPARTMENT INFO:
   • Name: ${deptAnalysis.department.name}
   • Total Employees: ${deptAnalysis.department.totalUsers}
   • Team Members: ${deptAnalysis.department.userNames}

📋 TASK STATISTICS:
   • Total Tasks: ${deptAnalysis.tasks.total}
   • Completed: ${deptAnalysis.tasks.completed} (${deptAnalysis.tasks.completionRate}%)
   • In Progress: ${deptAnalysis.tasks.inProgress}
   • Pending: ${deptAnalysis.tasks.pending}
   • Overdue: ${deptAnalysis.tasks.overdue}

👥 TOP PERFORMERS:
${deptAnalysis.tasks.topPerformers.map((p, i) => `   ${i + 1}. ${p.name}: ${p.completed}/${p.total} tasks completed`).join('\n')}

📊 WORKLOAD DISTRIBUTION:
${Object.entries(deptAnalysis.tasks.tasksByUser || {}).map(([name, stats]) => 
  `   • ${name}: ${stats.total} tasks (${stats.completed} completed, ${stats.inProgress} in progress, ${stats.pending} pending)`
).join('\n')}

📅 ATTENDANCE (Last 30 days):
   • Total Records: ${deptAnalysis.attendance.totalRecords}
   • Days Present: ${deptAnalysis.attendance.daysPresent}
   • Attendance Rate: ${deptAnalysis.attendance.attendanceRate}%
   • Total Hours: ${Math.round(deptAnalysis.attendance.totalHours)} hours
   • Average Hours/Day: ${deptAnalysis.attendance.avgHoursPerDay} hours
   • Overtime: ${Math.round(deptAnalysis.attendance.overtimeHours)} hours

👥 TEAM MEMBERS:
${deptAnalysis.users.map(u => `   • ${u.name} (${u.role}) - ${u.email}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: Use this detailed department data to answer accurately. Provide specific insights about the department.
`;
      } else {
        additionalContext = `\n\nNOTE: Department "${deptQuery}" was not found in the system.`;
      }
    }

    // Get or create conversation history
    const historyKey = sessionId || `${userId}-${Date.now()}`;
    let history = conversationHistory.get(historyKey) || [];

    // Gather context data for the AI
    console.log('📊 Gathering system context...');
    const context = await gatherAdminContext();
    console.log('✅ Context gathered:', {
      users: context.totalUsers,
      tasks: context.totalTasks,
      departments: context.totalDepartments
    });

    // Build system prompt with context and additional user/dept data
    const systemPrompt = buildSystemPrompt(context) + additionalContext;

    // Add user message to history
    history.push({
      role: 'user',
      content: message,
    });

    // Keep only last 10 messages to avoid token limits
    if (history.length > 10) {
      history = history.slice(-10);
    }

    console.log('🤖 Calling UniGuru AI for admin chatbot...');
    const result = await uniguruAIService.chat(message, historyKey, { systemPrompt });
    const aiResponse = result.answer || 'I apologize, I could not generate a response.';

    console.log('✅ AI Response generated (length):', aiResponse.length);
    console.log('💬 AI Response preview:', aiResponse.substring(0, 150) + '...');

    // Add AI response to history
    history.push({
      role: 'assistant',
      content: aiResponse,
    });

    // Save updated history
    conversationHistory.set(historyKey, history);

    // Clean up old conversations (keep for 1 hour)
    setTimeout(() => {
      conversationHistory.delete(historyKey);
    }, 60 * 60 * 1000);

    console.log('✅ Chatbot response sent successfully');

    res.json({
      response: aiResponse,
      sessionId: historyKey,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Chatbot error:', error.message);
    console.error('Error details:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error.message 
    });
  }
});

/**
 * Clear conversation history
 * POST /api/chatbot/clear
 */
router.post('/clear', auth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (sessionId && conversationHistory.has(sessionId)) {
      conversationHistory.delete(sessionId);
    }

    res.json({ message: 'Conversation cleared successfully' });
  } catch (error) {
    console.error('Error clearing conversation:', error);
    res.status(500).json({ error: 'Failed to clear conversation' });
  }
});

/**
 * Get system status and statistics
 * GET /api/chatbot/status
 */
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const context = await gatherAdminContext();
    
    res.json({
      status: 'operational',
      context: {
        totalUsers: context.totalUsers,
        totalTasks: context.totalTasks,
        totalDepartments: context.totalDepartments,
        pendingTasks: context.pendingTasks,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * Gather admin context data
 */
async function gatherAdminContext() {
  try {
    const [users, tasks, departments, attendance] = await Promise.all([
      User.countDocuments(),
      Task.find().select('title status priority dueDate assignee').limit(50).lean(),
      Department.find().select('name').lean(),
      Attendance.countDocuments({ date: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) } }),
    ]);

    const taskStats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'Pending').length,
      inProgress: tasks.filter(t => t.status === 'In Progress').length,
      completed: tasks.filter(t => t.status === 'Completed').length,
      overdue: tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'Completed').length,
    };

    return {
      totalUsers: users,
      totalTasks: tasks.length,
      totalDepartments: departments.length,
      attendanceThisWeek: attendance,
      taskStats,
      departments: departments.map(d => d.name),
      recentTasks: tasks.slice(0, 10).map(t => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
      })),
    };
  } catch (error) {
    console.error('Error gathering context:', error);
    return {
      totalUsers: 0,
      totalTasks: 0,
      totalDepartments: 0,
      taskStats: {},
    };
  }
}

/**
 * Detect if message is asking about a specific user
 */
function detectUserQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  const patterns = [
    /(?:show|tell|give|analyze|about|find|check)\s+(?:me\s+)?(?:everything\s+)?(?:about\s+)?(?:user\s+)?(?:employee\s+)?(\w+(?:\s+\w+)?)/i,
    /(?:how is|how's)\s+(\w+(?:\s+\w+)?)/i,
    /(\w+(?:\s+\w+)?)'s\s+(?:tasks|attendance|performance|data|record|profile|salary)/i,
    /(?:user|employee|person)\s+(?:named\s+)?(\w+(?:\s+\w+)?)/i,
  ];

  const excludeWords = ['the', 'this', 'that', 'my', 'our', 'all', 'any', 'every', 'some', 'system', 'task', 'department', 'team', 'many', 'status', 'breakdown', 'overview'];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const potentialName = match[1].trim();
      if (!excludeWords.includes(potentialName.toLowerCase())) {
        console.log('🎯 Detected user query for:', potentialName);
        return potentialName;
      }
    }
  }
  return null;
}

/**
 * Detect if message is asking about a specific department
 */
function detectDepartmentQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  const patterns = [
    /(?:show|analyze|give|tell)\s+(?:me\s+)?(\w+(?:\s+\w+)?)\s+department/i,
    /(?:department|dept)\s+(?:named\s+)?(\w+(?:\s+\w+)?)/i,
    /(\w+(?:\s+\w+)?)\s+(?:department|dept)\s+(?:analysis|data|stats|performance)/i,
    /(?:how is|how's)\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:department|dept)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const deptName = match[1].trim();
      console.log('🏢 Detected department query for:', deptName);
      return deptName;
    }
  }
  return null;
}

/**
 * Analyze a specific user by name
 */
async function analyzeUserByName(userName) {
  try {
    console.log('🔍 Searching for user:', userName);

    const user = await User.findOne({
      name: { $regex: userName, $options: 'i' },
      stillExist: 1
    }).populate('department', 'name').lean();

    if (!user) {
      return { found: false, message: `User "${userName}" not found.` };
    }

    console.log('✅ User found:', user.name);

    const [tasks, allTasks, attendance, aims, aiReviews, salaryData] = await Promise.all([
      Task.find({ assignee: user._id }).select('title status priority dueDate createdAt updatedAt progress').sort({ createdAt: -1 }).limit(50).lean(),
      Task.countDocuments({ assignee: user._id }),
      DailyAttendance.find({ user: user._id, date: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) } }).sort({ date: -1 }).lean(),
      Aim.find({ user: user._id, date: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) } }).lean(),
      AIReview.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
      SalaryAttendance.findOne({ userId: user._id.toString(), monthYear: new Date().toISOString().slice(0, 7) }).lean(),
    ]);

    const taskStats = {
      total: allTasks,
      completed: tasks.filter(t => t.status === 'Completed').length,
      inProgress: tasks.filter(t => t.status === 'In Progress').length,
      pending: tasks.filter(t => t.status === 'Pending').length,
      overdue: tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'Completed').length,
    };
    taskStats.completionRate = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;

    const completedTasks = tasks.filter(t => t.status === 'Completed' && t.updatedAt && t.createdAt);
    let avgCompletionTime = 0;
    if (completedTasks.length > 0) {
      const totalDays = completedTasks.reduce((sum, task) => {
        const days = (new Date(task.updatedAt) - new Date(task.createdAt)) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0);
      avgCompletionTime = Math.round((totalDays / completedTasks.length) * 10) / 10;
    }

    const attendanceStats = {
      totalDays: attendance.length,
      daysPresent: attendance.filter(a => a.isPresent).length,
      totalHours: attendance.reduce((sum, a) => sum + (a.totalHoursWorked || 0), 0),
      overtimeHours: attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0),
      lateArrivals: attendance.filter(a => a.hasDiscrepancy).length,
    };
    attendanceStats.attendanceRate = attendanceStats.totalDays > 0 ? Math.round((attendanceStats.daysPresent / attendanceStats.totalDays) * 100) : 0;
    attendanceStats.avgHoursPerDay = attendanceStats.daysPresent > 0 ? Math.round((attendanceStats.totalHours / attendanceStats.daysPresent) * 10) / 10 : 0;

    const aimStats = {
      total: aims.length,
      completed: aims.filter(a => a.completionStatus === 'Completed' || a.completionStatus === 'completed').length,
    };
    aimStats.completionRate = aimStats.total > 0 ? Math.round((aimStats.completed / aimStats.total) * 100) : 0;

    const aiStats = {
      totalReviews: aiReviews.length,
      avgScore: aiReviews.length > 0 ? Math.round(aiReviews.reduce((sum, r) => sum + (r.score || 0), 0) / aiReviews.length) : 0,
    };

    return {
      found: true,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department?.name || 'No department',
        employeeId: user.employeeId || 'N/A',
        hourlyRate: user.hourlyRate || 25,
        status: user.stillExist === 1 ? 'Active' : 'Inactive',
      },
      tasks: { ...taskStats, avgCompletionTime, recentTasks: tasks.slice(0, 5).map(t => ({ title: t.title, status: t.status, priority: t.priority })) },
      attendance: { ...attendanceStats, workingDays: 26 },
      aims: { ...aimStats, recentAim: aims[0]?.aims || 'No recent aims' },
      performance: { ...aiStats, recentReview: aiReviews[0] ? { score: aiReviews[0].score, comment: aiReviews[0].reviewText } : null },
      salary: salaryData ? { adjustedSalary: salaryData.adjustedSalary, totalHours: salaryData.hoursWorked, daysPresent: salaryData.daysPresent } : null,
    };
  } catch (error) {
    console.error('❌ Error analyzing user:', error);
    return { found: false, error: true, message: 'Error retrieving user data.' };
  }
}

/**
 * Analyze a specific department
 */
async function analyzeDepartmentByName(deptName) {
  try {
    console.log('🔍 Searching for department:', deptName);

    const department = await Department.findOne({
      name: { $regex: deptName, $options: 'i' }
    }).lean();

    if (!department) {
      return { found: false, message: `Department "${deptName}" not found.` };
    }

    console.log('✅ Department found:', department.name);

    const [users, tasks, attendance] = await Promise.all([
      User.find({ department: department._id, stillExist: 1 }).select('name email role employeeId hourlyRate').lean(),
      Task.find({ department: department._id }).populate('assignee', 'name').lean(),
      DailyAttendance.find({
        user: { $in: (await User.find({ department: department._id, stillExist: 1 }).select('_id')).map(u => u._id) },
        date: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
      }).lean(),
    ]);

    const taskStats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'Completed').length,
      inProgress: tasks.filter(t => t.status === 'In Progress').length,
      pending: tasks.filter(t => t.status === 'Pending').length,
      overdue: tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'Completed').length,
    };
    taskStats.completionRate = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;

    const tasksByUser = {};
    tasks.forEach(task => {
      if (task.assignee) {
        const userName = task.assignee.name;
        if (!tasksByUser[userName]) {
          tasksByUser[userName] = { total: 0, completed: 0, inProgress: 0, pending: 0 };
        }
        tasksByUser[userName].total++;
        if (task.status === 'Completed') tasksByUser[userName].completed++;
        if (task.status === 'In Progress') tasksByUser[userName].inProgress++;
        if (task.status === 'Pending') tasksByUser[userName].pending++;
      }
    });

    const attendanceStats = {
      totalRecords: attendance.length,
      daysPresent: attendance.filter(a => a.isPresent).length,
      totalHours: attendance.reduce((sum, a) => sum + (a.totalHoursWorked || 0), 0),
      overtimeHours: attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0),
      avgHoursPerDay: 0,
    };
    attendanceStats.avgHoursPerDay = attendanceStats.daysPresent > 0 ? Math.round((attendanceStats.totalHours / attendanceStats.daysPresent) * 10) / 10 : 0;
    attendanceStats.attendanceRate = users.length > 0 && attendanceStats.totalRecords > 0 ? Math.round((attendanceStats.daysPresent / (users.length * 26)) * 100) : 0;

    const topPerformers = Object.entries(tasksByUser)
      .sort((a, b) => b[1].completed - a[1].completed)
      .slice(0, 5)
      .map(([name, stats]) => ({ name, completed: stats.completed, total: stats.total }));

    return {
      found: true,
      department: {
        name: department.name,
        totalUsers: users.length,
        userNames: users.map(u => u.name).join(', '),
      },
      tasks: { ...taskStats, tasksByUser, topPerformers },
      attendance: attendanceStats,
      users: users.map(u => ({ name: u.name, role: u.role, email: u.email })),
    };
  } catch (error) {
    console.error('❌ Error analyzing department:', error);
    return { found: false, error: true, message: 'Error retrieving department data.' };
  }
}

/**
 * Build system prompt with context
 */
function buildSystemPrompt(context) {
  return `You are an expert AI assistant for the Infiverse Workflow Management System. You help administrators with accurate, data-driven insights and recommendations.

═══════════════════════════════════════════════════════════════
📊 REAL-TIME SYSTEM DATA (Use this for accurate answers!)
═══════════════════════════════════════════════════════════════

👥 USERS & ORGANIZATION:
   • Total Users in System: ${context.totalUsers}
   • Total Departments: ${context.totalDepartments}
   • Departments: ${context.departments?.join(', ') || 'No departments yet'}

📋 TASK MANAGEMENT:
   • Total Tasks: ${context.totalTasks}
   • ✅ Completed Tasks: ${context.taskStats?.completed || 0}
   • 🔄 In Progress: ${context.taskStats?.inProgress || 0}
   • ⏳ Pending Tasks: ${context.taskStats?.pending || 0}
   • ⚠️ Overdue Tasks: ${context.taskStats?.overdue || 0}

📅 ATTENDANCE:
   • Records (Last 7 days): ${context.attendanceThisWeek}

📌 RECENT TASKS:
${context.recentTasks?.map(t => `   • "${t.title}" - ${t.status} (${t.priority} priority)`).join('\n') || '   No recent tasks'}

═══════════════════════════════════════════════════════════════
🎯 YOUR ROLE & INSTRUCTIONS
═══════════════════════════════════════════════════════════════

1. **ALWAYS use the real-time data above when answering questions about:**
   - User counts, task numbers, department info
   - System statistics and metrics
   - Current status and performance

2. **Be ACCURATE and DATA-DRIVEN:**
   - Quote exact numbers from the data provided
   - Don't make up or estimate statistics
   - If asked about something not in the data, say "I don't have that information"

3. **Format responses professionally:**
   - Use emojis for visual clarity (📊 📈 ✅ ⚠️)
   - Use bullet points and numbered lists
   - Be concise but informative
   - Highlight important numbers

4. **Provide ACTIONABLE insights:**
   - Suggest specific next steps
   - Recommend best practices
   - Offer workflow optimization tips
   - Help with decision making

5. **Help with common admin tasks:**
   - User and department management
   - Task assignment and tracking
   - Performance monitoring
   - System configuration
   - Report interpretation

6. **USER-SPECIFIC & DEPARTMENT-SPECIFIC ANALYSIS:**
   - When asked about a specific user (e.g., "Show me John's data"), you have access to their complete profile
   - When asked about a department (e.g., "Analyze Engineering department"), you have full department data
   - Use this detailed data to provide comprehensive, accurate analysis
   - Include tasks, attendance, performance, salary, and insights

═══════════════════════════════════════════════════════════════
💡 EXAMPLE RESPONSES
═══════════════════════════════════════════════════════════════

Question: "How many users are in the system?"
Answer: "You currently have **${context.totalUsers} users** in your system."

Question: "What's the task status?"
Answer: "Here's your current task breakdown:
• ✅ Completed: ${context.taskStats?.completed || 0} tasks
• 🔄 In Progress: ${context.taskStats?.inProgress || 0} tasks
• ⏳ Pending: ${context.taskStats?.pending || 0} tasks
• ⚠️ Overdue: ${context.taskStats?.overdue || 0} tasks

${context.taskStats?.overdue > 0 ? '⚠️ You have overdue tasks that need immediate attention!' : '✅ No overdue tasks - great job!'}"

Question: "Give me optimization tips"
Answer: [Provide specific, actionable advice based on the data]

═══════════════════════════════════════════════════════════════

**Remember:** Be helpful, accurate, and use the REAL DATA provided. Never guess or make up numbers!`;
}

module.exports = router;

