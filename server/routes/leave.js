const express = require('express');
const router = express.Router();
const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Notification = require('../models/Notification');
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

// Submit leave request
router.post('/request', auth, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      reason,
      leaveType,
      isHalfDay,
      emergencyContact,
      handoverNotes,
      priority
    } = req.body;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      return res.status(400).json({ 
        error: 'Leave start date cannot be in the past' 
      });
    }

    if (end < start) {
      return res.status(400).json({ 
        error: 'Leave end date cannot be before start date' 
      });
    }

    // Check for overlapping leave requests
    const overlappingLeave = await Leave.findOne({
      user: req.user.id,
      status: { $in: ['Pending', 'Approved'] },
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ]
    });

    if (overlappingLeave) {
      return res.status(400).json({ 
        error: 'You already have a leave request for overlapping dates',
        conflictingLeave: {
          startDate: overlappingLeave.startDate,
          endDate: overlappingLeave.endDate,
          status: overlappingLeave.status
        }
      });
    }

    // Create leave request with branch from header
    const selectedBranch = req.headers['x-branch'] || req.query.branch || req.user.branch || 'blackhole_mumbai';
    const leaveRequest = new Leave({
      user: req.user.id,
      startDate: start,
      endDate: end,
      reason,
      leaveType: leaveType || 'Personal',
      isHalfDay: isHalfDay || false,
      emergencyContact,
      handoverNotes,
      priority: priority || 'Medium',
      branch: selectedBranch
    });

    await leaveRequest.save();

    // Create notification for managers/admins
    const managers = await User.find({ 
      role: { $in: ['Admin', 'Manager'] },
      department: req.user.department 
    });

    for (const manager of managers) {
      await Notification.create({
        recipient: manager._id,
        type: 'leave_request',
        title: 'New Leave Request',
        message: `${req.user.name} has submitted a leave request from ${start.toDateString()} to ${end.toDateString()}`,
        task: null // We could create a reference to the leave request if needed
      });
    }

    // Emit socket event
    if (req.io) {
      req.io.emit('leave:request-submitted', {
        leaveId: leaveRequest._id,
        userId: req.user.id,
        userName: req.user.name,
        startDate: start,
        endDate: end,
        leaveType,
        priority
      });
    }

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: leaveRequest
    });

  } catch (error) {
    console.error('Leave request error:', error);
    res.status(500).json({ error: 'Failed to submit leave request' });
  }
});

// Get user's leave history
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, year, page = 1, limit = 20 } = req.query;

    // Verify user authorization
    if (req.user.id !== userId && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Build filter
    const filter = { user: userId };
    
    if (status) {
      filter.status = status;
    }

    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31);
      filter.startDate = { $gte: startOfYear, $lte: endOfYear };
    }

    const skip = (page - 1) * limit;

    const leaves = await Leave.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('approvedBy', 'name email')
      .populate('user', 'name email');

    const total = await Leave.countDocuments(filter);

    // Get leave statistics
    const currentYear = new Date().getFullYear();
    const stats = await Leave.getLeaveStats(userId, currentYear);

    res.json({
      success: true,
      data: {
        leaves,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        stats
      }
    });

  } catch (error) {
    console.error('Leave history error:', error);
    res.status(500).json({ error: 'Failed to fetch leave history' });
  }
});

// Get pending leave requests (admin/manager only)
router.get('/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { department, priority, page = 1, limit = 20 } = req.query;
    const branchQuery = getBranchQuery(req);

    // Build filter with branch
    const filter = { status: 'Pending', ...branchQuery };

    // If manager, only show requests from their department
    if (req.user.role === 'Manager' && req.user.department) {
      const departmentUsers = await User.find({ 
        department: req.user.department,
        ...branchQuery 
      }).select('_id');
      filter.user = { $in: departmentUsers.map(u => u._id) };
    }

    if (department) {
      const departmentUsers = await User.find({ department, ...branchQuery }).select('_id');
      filter.user = { $in: departmentUsers.map(u => u._id) };
    }

    if (priority) {
      filter.priority = priority;
    }

    const skip = (page - 1) * limit;

    const pendingLeaves = await Leave.find(filter)
      .sort({ priority: 1, createdAt: 1 }) // Urgent first, then oldest first
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name email avatar department')
      .populate('user.department', 'name');

    const total = await Leave.countDocuments(filter);

    // Get summary statistics
    const summary = await Leave.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
          avgDays: { $avg: '$totalDays' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        pendingLeaves,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        summary
      }
    });

  } catch (error) {
    console.error('Pending leaves error:', error);
    res.status(500).json({ error: 'Failed to fetch pending leave requests' });
  }
});

// Approve leave request
router.put('/:id/approve', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { id } = req.params;
    const { notes } = req.body;

    const leaveRequest = await Leave.findById(id).populate('user', 'name email');

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({ 
        error: `Leave request is already ${leaveRequest.status.toLowerCase()}` 
      });
    }

    // Update leave request
    leaveRequest.status = 'Approved';
    leaveRequest.approvedBy = req.user.id;
    leaveRequest.approvedAt = new Date();
    if (notes) {
      leaveRequest.handoverNotes = notes;
    }

    await leaveRequest.save();

    // Create attendance records for leave days
    const currentDate = new Date(leaveRequest.startDate);
    const endDate = new Date(leaveRequest.endDate);

    while (currentDate <= endDate) {
      // Skip weekends (optional - depends on company policy)
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        const existingAttendance = await Attendance.findOne({
          user: leaveRequest.user._id,
          date: new Date(currentDate)
        });

        if (existingAttendance) {
          existingAttendance.isLeave = true;
          existingAttendance.leaveType = leaveRequest.leaveType;
          existingAttendance.leaveReference = leaveRequest._id;
          existingAttendance.isPresent = true; // On leave counts as present
          existingAttendance.source = 'Leave';
          await existingAttendance.save();
        } else {
          await Attendance.create({
            user: leaveRequest.user._id,
            date: new Date(currentDate),
            isLeave: true,
            leaveType: leaveRequest.leaveType,
            leaveReference: leaveRequest._id,
            isPresent: true,
            source: 'Leave'
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Create notification for employee
    await Notification.create({
      recipient: leaveRequest.user._id,
      type: 'leave_approved',
      title: 'Leave Request Approved',
      message: `Your leave request from ${leaveRequest.startDate.toDateString()} to ${leaveRequest.endDate.toDateString()} has been approved`,
      task: null
    });

    // Emit socket event
    if (req.io) {
      req.io.emit('leave:approved', {
        leaveId: leaveRequest._id,
        userId: leaveRequest.user._id,
        approvedBy: req.user.name,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate
      });
    }

    res.json({
      success: true,
      message: 'Leave request approved successfully',
      data: leaveRequest
    });

  } catch (error) {
    console.error('Approve leave error:', error);
    res.status(500).json({ error: 'Failed to approve leave request' });
  }
});

// Reject leave request
router.put('/:id/reject', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const leaveRequest = await Leave.findById(id).populate('user', 'name email');

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({
        error: `Leave request is already ${leaveRequest.status.toLowerCase()}`
      });
    }

    // Update leave request
    leaveRequest.status = 'Rejected';
    leaveRequest.approvedBy = req.user.id;
    leaveRequest.rejectedAt = new Date();
    leaveRequest.rejectionReason = rejectionReason;

    await leaveRequest.save();

    // Create notification for employee
    await Notification.create({
      recipient: leaveRequest.user._id,
      type: 'leave_rejected',
      title: 'Leave Request Rejected',
      message: `Your leave request from ${leaveRequest.startDate.toDateString()} to ${leaveRequest.endDate.toDateString()} has been rejected. Reason: ${rejectionReason}`,
      task: null
    });

    // Emit socket event
    if (req.io) {
      req.io.emit('leave:rejected', {
        leaveId: leaveRequest._id,
        userId: leaveRequest.user._id,
        rejectedBy: req.user.name,
        rejectionReason,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate
      });
    }

    res.json({
      success: true,
      message: 'Leave request rejected',
      data: leaveRequest
    });

  } catch (error) {
    console.error('Reject leave error:', error);
    res.status(500).json({ error: 'Failed to reject leave request' });
  }
});

// Get leave analytics
router.get('/analytics', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { year = new Date().getFullYear(), department } = req.query;

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    // Build match condition
    const matchCondition = {
      startDate: { $gte: startOfYear, $lte: endOfYear }
    };

    if (department) {
      const departmentUsers = await User.find({ department }).select('_id');
      matchCondition.user = { $in: departmentUsers.map(u => u._id) };
    }

    // Overall statistics
    const overallStats = await Leave.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          approvedRequests: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
          rejectedRequests: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
          pendingRequests: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          totalDays: { $sum: '$totalDays' },
          avgDaysPerRequest: { $avg: '$totalDays' }
        }
      }
    ]);

    // Leave type breakdown
    const leaveTypeStats = await Leave.aggregate([
      { $match: { ...matchCondition, status: 'Approved' } },
      {
        $group: {
          _id: '$leaveType',
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Monthly breakdown
    const monthlyStats = await Leave.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: {
            month: { $month: '$startDate' },
            year: { $year: '$startDate' }
          },
          totalRequests: { $sum: 1 },
          approvedRequests: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
          totalDays: { $sum: '$totalDays' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Top leave takers
    const topLeaveTakers = await Leave.aggregate([
      { $match: { ...matchCondition, status: 'Approved' } },
      {
        $group: {
          _id: '$user',
          totalDays: { $sum: '$totalDays' },
          requestCount: { $sum: 1 }
        }
      },
      { $sort: { totalDays: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          totalDays: 1,
          requestCount: 1,
          avgDaysPerRequest: { $divide: ['$totalDays', '$requestCount'] }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overall: overallStats[0] || {},
        leaveTypes: leaveTypeStats,
        monthly: monthlyStats,
        topLeaveTakers,
        year: parseInt(year)
      }
    });

  } catch (error) {
    console.error('Leave analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch leave analytics' });
  }
});

// Cancel leave request (employee only, before approval)
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const leaveRequest = await Leave.findById(id);

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    // Only the employee who created the request can cancel it
    if (leaveRequest.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({
        error: `Cannot cancel ${leaveRequest.status.toLowerCase()} leave request`
      });
    }

    // Update leave request
    leaveRequest.status = 'Rejected';
    leaveRequest.rejectionReason = reason || 'Cancelled by employee';
    leaveRequest.rejectedAt = new Date();

    await leaveRequest.save();

    // Emit socket event
    if (req.io) {
      req.io.emit('leave:cancelled', {
        leaveId: leaveRequest._id,
        userId: req.user.id,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate
      });
    }

    res.json({
      success: true,
      message: 'Leave request cancelled successfully',
      data: leaveRequest
    });

  } catch (error) {
    console.error('Cancel leave error:', error);
    res.status(500).json({ error: 'Failed to cancel leave request' });
  }
});

module.exports = router;
