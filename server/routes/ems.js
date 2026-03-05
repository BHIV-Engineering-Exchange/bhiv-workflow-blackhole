const express = require('express');
const router = express.Router();
const emsAutomation = require('../services/emsAutomation');
const EmailTemplate = require('../models/EmailTemplate');
const ScheduledEmail = require('../models/ScheduledEmail');
const Task = require('../models/Task');
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Helper to get branch filter from request
const getBranchQuery = (req) => {
  const selectedBranch = req.headers['x-branch'] || req.query.branch;
  if (selectedBranch && selectedBranch !== 'all') {
    return { branch: selectedBranch };
  }
  return {};
};

// Send task assignment email
router.post('/send-task-assignment', auth, adminAuth, async (req, res) => {
  try {
    const { taskId, assigneeId } = req.body;

    if (!taskId || !assigneeId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'taskId and assigneeId are required'
      });
    }

    const result = await emsAutomation.sendTaskAssignmentEmail(taskId, assigneeId, req.user.id);

    res.json({
      success: true,
      message: 'Task assignment email sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending task assignment email:', error);
    res.status(500).json({
      error: 'Failed to send email',
      message: error.message
    });
  }
});

// Send task reminder emails - FILTERED BY BRANCH
router.post('/send-task-reminders', auth, async (req, res) => {
  try {
    const { reminderType = 'due_soon' } = req.body;
    const branchQuery = getBranchQuery(req);

    if (!reminderType) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'reminderType is required'
      });
    }

    // Find tasks based on reminder type and branch
    let query = { ...branchQuery };

    switch (reminderType) {
      case 'due_soon':
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        query = {
          ...query,
          dueDate: { $lte: tomorrow, $gte: new Date() },
          status: { $ne: 'Completed' }
        };
        break;
      case 'overdue':
        query = {
          ...query,
          dueDate: { $lt: new Date() },
          status: { $ne: 'Completed' }
        };
        break;
      default:
        query = { ...query, status: { $ne: 'Completed' } };
    }

    const tasks = await Task.find(query).populate('assignee');

    if (tasks.length === 0) {
      return res.json({
        success: true,
        message: 'No tasks found for reminders',
        results: []
      });
    }

    const results = [];

    for (const task of tasks) {
      try {
        const result = await emsAutomation.sendTaskReminderEmail(task._id, reminderType);
        results.push({ taskId: task._id, success: true, result });
      } catch (error) {
        results.push({ taskId: task._id, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Processed ${tasks.length} task reminders: ${successCount} sent, ${failureCount} failed`,
      results,
      summary: {
        total: tasks.length,
        successful: successCount,
        failed: failureCount
      }
    });
  } catch (error) {
    console.error('Error sending task reminders:', error);
    res.status(500).json({
      error: 'Failed to send reminders',
      message: error.message
    });
  }
});

// Send overdue task alerts - FILTERED BY BRANCH
router.post('/send-overdue-alerts', auth, adminAuth, async (req, res) => {
  try {
    const branchQuery = getBranchQuery(req);
    
    // Find overdue tasks filtered by branch
    const overdueTasks = await Task.find({
      ...branchQuery,
      dueDate: { $lt: new Date() },
      status: { $ne: 'Completed' }
    }).populate('assignee');

    const results = [];
    
    for (const task of overdueTasks) {
      try {
        const result = await emsAutomation.sendTaskOverdueEmail(task._id);
        results.push({ taskId: task._id, success: true, result });
      } catch (error) {
        results.push({ taskId: task._id, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Processed ${overdueTasks.length} overdue tasks`,
      results
    });
  } catch (error) {
    console.error('Error sending overdue alerts:', error);
    res.status(500).json({
      error: 'Failed to send overdue alerts',
      message: error.message
    });
  }
});

// Send custom email to employees
router.post('/send-custom-email', auth, adminAuth, async (req, res) => {
  try {
    const { recipients, subject, htmlBody, scheduleTime } = req.body;

    if (!recipients || !subject || !htmlBody) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'recipients, subject, and htmlBody are required'
      });
    }

    let result;
    const senderId = req.user?.id || req.user?._id || null;
    
    if (scheduleTime) {
      result = await emsAutomation.scheduleEmail(
        subject,
        htmlBody,
        recipients,
        scheduleTime,
        'system_notification',
        senderId
      );
    } else {
      result = await emsAutomation.sendEmail(subject, htmlBody, recipients, senderId);
    }

    res.json({
      success: true,
      message: scheduleTime ? 'Email scheduled successfully' : 'Email sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending custom email:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to send email',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Send bulk task emails
router.post('/send-bulk-task-emails', auth, adminAuth, async (req, res) => {
  try {
    const { taskIds, templateId } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || !templateId) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'taskIds (array) and templateId are required'
      });
    }

    const results = await emsAutomation.sendBulkTaskEmails(taskIds, templateId, req.user.id);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Bulk email operation completed: ${successCount} sent, ${failureCount} failed`,
      results,
      summary: {
        total: taskIds.length,
        successful: successCount,
        failed: failureCount
      }
    });
  } catch (error) {
    console.error('Error sending bulk task emails:', error);
    res.status(500).json({
      error: 'Failed to send bulk emails',
      message: error.message
    });
  }
});

// Get email templates
router.get('/templates', auth, async (req, res) => {
  try {
    const templates = await EmailTemplate.find({ isActive: true })
      .select('templateId name subject category')
      .sort({ category: 1, name: 1 });

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      error: 'Failed to fetch templates',
      message: error.message
    });
  }
});

// Get scheduled emails
router.get('/scheduled-emails', auth, adminAuth, async (req, res) => {
  try {
    const { status = 'scheduled', limit = 50 } = req.query;
    
    const scheduledEmails = await ScheduledEmail.find({ status })
      .populate('createdBy', 'name email')
      .sort({ scheduledTime: 1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      scheduledEmails
    });
  } catch (error) {
    console.error('Error fetching scheduled emails:', error);
    res.status(500).json({
      error: 'Failed to fetch scheduled emails',
      message: error.message
    });
  }
});

// Cancel scheduled email
router.delete('/scheduled-emails/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const scheduledEmail = await ScheduledEmail.findById(id);
    
    if (!scheduledEmail) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Scheduled email not found'
      });
    }

    if (scheduledEmail.status !== 'scheduled') {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'Can only cancel scheduled emails'
      });
    }

    scheduledEmail.status = 'cancelled';
    await scheduledEmail.save();

    res.json({
      success: true,
      message: 'Scheduled email cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling scheduled email:', error);
    res.status(500).json({
      error: 'Failed to cancel email',
      message: error.message
    });
  }
});

// Process scheduled emails (manual trigger)
router.post('/process-scheduled', auth, adminAuth, async (req, res) => {
  try {
    const processed = await emsAutomation.processScheduledEmails();

    res.json({
      success: true,
      message: `Processed ${processed} scheduled emails`,
      processed
    });
  } catch (error) {
    console.error('Error processing scheduled emails:', error);
    res.status(500).json({
      error: 'Failed to process scheduled emails',
      message: error.message
    });
  }
});

// Get EMS statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get scheduled emails count
    const totalScheduled = await ScheduledEmail.countDocuments({
      status: 'scheduled'
    });

    // Get emails sent today
    const sentToday = await ScheduledEmail.countDocuments({
      status: 'sent',
      sentAt: { $gte: today }
    });

    // Get pending emails (scheduled but not sent)
    const pending = await ScheduledEmail.countDocuments({
      status: 'scheduled',
      scheduledTime: { $lte: now }
    });

    res.json({
      success: true,
      data: {
        totalScheduled,
        sentToday,
        pending
      }
    });
  } catch (error) {
    console.error('Error fetching EMS stats:', error);
    res.status(500).json({
      error: 'Failed to fetch EMS stats',
      message: error.message
    });
  }
});

// Get tasks for email operations
router.get('/tasks-for-email', auth, adminAuth, async (req, res) => {
  try {
    const { type = 'all' } = req.query;

    let query = {};

    switch (type) {
      case 'pending':
        query = { status: 'Pending' };
        break;
      case 'overdue':
        query = {
          dueDate: { $lt: new Date() },
          status: { $ne: 'Completed' }
        };
        break;
      case 'due_soon':
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        query = {
          dueDate: { $lte: tomorrow, $gte: new Date() },
          status: { $ne: 'Completed' }
        };
        break;
    }

    const tasks = await Task.find(query)
      .populate('assignee', 'name email')
      .populate('department', 'name')
      .select('title description status priority dueDate progress')
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      tasks: tasks.map(task => ({
        _id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        progress: task.progress,
        assignee: task.assignee,
        department: task.department
      }))
    });
  } catch (error) {
    console.error('Error fetching tasks for email:', error);
    res.status(500).json({
      error: 'Failed to fetch tasks',
      message: error.message
    });
  }
});

// Send automated daily task reminders (for background job)
router.post('/send-daily-reminders', async (req, res) => {
  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find tasks due tomorrow
    const dueSoonTasks = await Task.find({
      dueDate: { $lte: tomorrow, $gte: now },
      status: { $ne: 'Completed' }
    }).populate('assignee');

    // Find overdue tasks
    const overdueTasks = await Task.find({
      dueDate: { $lt: now },
      status: { $ne: 'Completed' }
    }).populate('assignee');

    const allTasks = [...dueSoonTasks, ...overdueTasks];
    const results = [];

    for (const task of allTasks) {
      try {
        const reminderType = task.dueDate < now ? 'overdue' : 'due_soon';
        const result = await emsAutomation.sendTaskReminderEmail(task._id, reminderType);
        results.push({ taskId: task._id, success: true, result, type: reminderType });
      } catch (error) {
        results.push({ taskId: task._id, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Daily reminder automation completed: ${successCount} sent, ${failureCount} failed`,
      results,
      summary: {
        total: allTasks.length,
        successful: successCount,
        failed: failureCount,
        dueSoon: dueSoonTasks.length,
        overdue: overdueTasks.length
      }
    });
  } catch (error) {
    console.error('Error in daily reminder automation:', error);
    res.status(500).json({
      error: 'Failed to run daily reminders',
      message: error.message
    });
  }
});

// Send welcome email to new users
router.post('/send-welcome-email/:userId', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    const context = {
      employee_name: user.name,
      employee_email: user.email,
      login_url: `${process.env.FRONTEND_URL || 'http://localhost:5175'}/login`,
      company_name: 'Infiverse'
    };

    const welcomeTemplate = {
      templateId: 'welcome_email',
      name: 'Welcome Email',
      subject: 'Welcome to Infiverse - Your Account is Ready!',
      htmlBody: `
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
            <h1 style="color: #333; margin: 0;">Welcome to Infiverse!</h1>
          </div>
          <div style="padding: 30px;">
            <h2>Hello {employee_name},</h2>
            <p>Welcome to the {company_name} team! Your account has been successfully created and you can now access our workflow management system.</p>

            <div style="background-color: #e9ecef; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Your login details:</strong></p>
              <p>Email: {employee_email}</p>
              <p>Please use the password provided by your administrator to log in.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="{login_url}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Login to Your Account</a>
            </div>

            <p>If you have any questions or need assistance, please don't hesitate to contact your administrator.</p>

            <p>Best regards,<br>The {company_name} Team</p>
          </div>
        </body>
        </html>
      `,
      category: 'system'
    };

    const subject = emsAutomation.renderTemplate(welcomeTemplate.subject, context);
    const htmlBody = emsAutomation.renderTemplate(welcomeTemplate.htmlBody, context);

    const result = await emsAutomation.sendEmail(subject, htmlBody, [user.email], req.user.id);

    res.json({
      success: true,
      message: 'Welcome email sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    res.status(500).json({
      error: 'Failed to send welcome email',
      message: error.message
    });
  }
});

// Send password reset email
router.post('/send-password-reset/:userId', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Generate a temporary reset token (in a real app, this would be more secure)
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const context = {
      employee_name: user.name,
      reset_link: `${process.env.FRONTEND_URL || 'http://localhost:5175'}/reset-password?token=${resetToken}`,
      company_name: 'Infiverse',
      expiry_hours: '24'
    };

    const resetTemplate = {
      templateId: 'password_reset',
      name: 'Password Reset Email',
      subject: 'Password Reset Request - {company_name}',
      htmlBody: `
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #fff3cd; padding: 20px; text-align: center; border-bottom: 3px solid #ffc107;">
            <h1 style="color: #856404; margin: 0;">Password Reset Request</h1>
          </div>
          <div style="padding: 30px;">
            <h2>Hello {employee_name},</h2>
            <p>You have requested to reset your password for your {company_name} account.</p>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff;">
              <p><strong>Click the link below to reset your password:</strong></p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="{reset_link}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
              </div>
              <p><small>This link will expire in {expiry_hours} hours for security reasons.</small></p>
            </div>

            <p><strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>

            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 3px;">{reset_link}</p>

            <p>Best regards,<br>The {company_name} Security Team</p>
          </div>
        </body>
        </html>
      `,
      category: 'security'
    };

    const subject = emsAutomation.renderTemplate(resetTemplate.subject, context);
    const htmlBody = emsAutomation.renderTemplate(resetTemplate.htmlBody, context);

    const result = await emsAutomation.sendEmail(subject, htmlBody, [user.email], req.user.id);

    res.json({
      success: true,
      message: 'Password reset email sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending password reset email:', error);
    res.status(500).json({
      error: 'Failed to send password reset email',
      message: error.message
    });
  }
});

module.exports = router;