const express = require('express');
const router = express.Router();
const DailyAttendance = require('../models/DailyAttendance');
const User = require('../models/User');
const UserTag = require('../models/UserTag');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const geolib = require('geolib');
const enhancedSalaryCalculator = require('../services/enhancedSalaryCalculator');

// Office coordinates from environment variables - Blackhole Infiverse LLP Mumbai
const OFFICE_COORDINATES = {
  latitude: parseFloat(process.env.OFFICE_LAT) || 19.1628987,
  longitude: parseFloat(process.env.OFFICE_LNG) || 72.8355871
};
const OFFICE_RADIUS = parseInt(process.env.OFFICE_RADIUS) || 100; // meters
const MAX_WORKING_HOURS = parseInt(process.env.MAX_WORKING_HOURS) || 8;

// Start day with enhanced validation and status tracking
router.post('/start-day', auth, async (req, res) => {
  try {
    const { latitude, longitude, address, accuracy, deviceInfo, workFromHome } = req.body;
    const userId = req.user.id;

    // Validate geolocation
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        success: false,
        error: 'Geolocation data required' 
      });
    }

    // Get user's location restrictions
    const userTag = await UserTag.findOne({ user: userId });
    let allowedRadius = OFFICE_RADIUS;
    let allowRemote = false;
    let strictLocationCheck = true;

    if (userTag?.locationRestrictions) {
      allowedRadius = userTag.locationRestrictions.officeRadius || OFFICE_RADIUS;
      allowRemote = userTag.locationRestrictions.allowRemote || false;
      strictLocationCheck = userTag.locationRestrictions.strictLocationCheck !== false;
    }

    let workLocationType = 'Office';
    let locationValidated = true;

    // Location validation
    if (!workFromHome) {
      // Check office location
      const distanceFromOffice = geolib.getDistance(
        { latitude: OFFICE_COORDINATES.latitude, longitude: OFFICE_COORDINATES.longitude },
        { latitude, longitude }
      );

      if (distanceFromOffice > allowedRadius) {
        return res.status(400).json({
          success: false,
          error: `You must be within ${allowedRadius}m of office to start your day`,
          distance: distanceFromOffice,
          allowedRadius,
          officeAddress: "Blackhole Infiverse LLP, Road Number 3, near Hathi Circle, above Bright Connection, Kala Galli, Motilal Nagar II, Goregaon West, Mumbai, Maharashtra 400104",
          userLocation: { latitude, longitude, address },
          showWorkFromHomeOption: allowRemote
        });
      }
    } else {
      // Work from home option selected
      if (!allowRemote) {
        return res.status(400).json({
          success: false,
          error: 'Work from home is not allowed for your account'
        });
      }
      workLocationType = 'Home';
      // Lock the home location for the day
      locationValidated = true;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if user has already started day
    const existingRecord = await DailyAttendance.findOne({
      user: userId,
      date: today
    });

    if (existingRecord?.startDayTime) {
      return res.status(400).json({ 
        success: false,
        error: 'Day already started',
        startTime: existingRecord.startDayTime,
        data: {
          startTime: existingRecord.startDayTime,
          location: existingRecord.startDayLocation,
          status: existingRecord.status
        }
      });
    }

    const startTime = new Date();
    const startDayData = {
      user: userId,
      date: today,
      startDayTime: startTime,
      startDayLocation: {
        latitude,
        longitude,
        address,
        accuracy
      },
      startDayDevice: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        deviceType: deviceInfo?.deviceType || 'Unknown'
      },
      workLocationType: workLocationType, // Office or Home
      source: 'StartDay',
      status: 'Present',
      isPresent: true,
      verificationMethod: 'StartDay'
    };

    let attendanceRecord;
    if (existingRecord) {
      // Update existing record
      Object.assign(existingRecord, startDayData);
      attendanceRecord = await existingRecord.save();
    } else {
      // Create new record
      attendanceRecord = new DailyAttendance(startDayData);
      await attendanceRecord.save();
    }

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit('attendance:day-started', {
        userId,
        userName: req.user.name,
        startTime,
        location: { latitude, longitude, address }
      });
    }

    res.json({
      success: true,
      message: 'Day started successfully!',
      data: {
        attendanceId: attendanceRecord._id,
        startTime,
        location: { latitude, longitude, address },
        status: attendanceRecord.status,
        canEndDay: true
      }
    });

  } catch (error) {
    console.error('Start day error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to start day',
      details: error.message 
    });
  }
});

// End day with comprehensive calculation
router.post('/end-day', auth, async (req, res) => {
  try {
    const { latitude, longitude, address, accuracy, notes, deviceInfo } = req.body;
    const userId = req.user.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find most recent open/unended attendance session for this user (supports overnight sessions across midnight)
    const attendanceRecord = await DailyAttendance.findOne({
      user: userId,
      startDayTime: { $exists: true, $ne: null },
      $or: [{ endDayTime: { $exists: false } }, { endDayTime: null }]
    }).sort({ startDayTime: -1 });

    if (!attendanceRecord?.startDayTime) {
      return res.status(400).json({ 
        success: false,
        error: 'Day not started yet. Please start your day first.' 
      });
    }

    if (attendanceRecord.endDayTime) {
      return res.status(400).json({ 
        success: false,
        error: 'Day already ended',
        endTime: attendanceRecord.endDayTime,
        data: {
          startTime: attendanceRecord.startDayTime,
          endTime: attendanceRecord.endDayTime,
          totalHours: attendanceRecord.totalHoursWorked,
          status: attendanceRecord.status
        }
      });
    }

    const sessionDate = attendanceRecord.date || today;
    const sessionDateEnd = new Date(sessionDate);
    sessionDateEnd.setDate(sessionDateEnd.getDate() + 1);

    // Check for mandatory daily aim completion
    const Aim = require('../models/Aim');
    const Progress = require('../models/Progress');
    
    const todayAim = await Aim.findOne({
      user: userId,
      date: {
        $gte: sessionDate,
        $lt: sessionDateEnd
      }
    });

    // Validate aim completion
    if (!todayAim) {
      return res.status(400).json({
        success: false,
        error: 'Please set and complete your daily aim before ending your day',
        code: 'AIM_NOT_SET',
        message: 'Daily aim completion is mandatory before ending work day'
      });
    }

    if (!todayAim.completionStatus || todayAim.completionStatus === 'Pending') {
      return res.status(400).json({
        success: false,
        error: 'Please complete your daily aim before ending your day',
        code: 'AIM_NOT_COMPLETED',
        message: 'You must mark your aim as Completed or MVP Achieved with a comment',
        aim: {
          id: todayAim._id,
          content: todayAim.aims,
          status: todayAim.completionStatus
        }
      });
    }

    if ((todayAim.completionStatus === 'Completed' || todayAim.completionStatus === 'MVP Achieved') && 
        (!todayAim.completionComment || todayAim.completionComment.trim() === '')) {
      return res.status(400).json({
        success: false,
        error: 'Completion comment is required for your completed aim',
        code: 'AIM_COMMENT_MISSING',
        message: 'Please add a comment describing your achievements'
      });
    }

    // Check for daily progress (optional but recommended)
    const todayProgress = await Progress.findOne({
      user: userId,
      date: {
        $gte: sessionDate,
        $lt: sessionDateEnd
      }
    });

    // Check if progress has any meaningful content
    const hasProgressContent = todayProgress && (
      (todayProgress.notes && todayProgress.notes.trim() !== '') ||
      (todayProgress.achievements && todayProgress.achievements.trim() !== '') ||
      (todayProgress.blockers && todayProgress.blockers.trim() !== '')
    );
    
    if (!hasProgressContent) {
      return res.status(400).json({
        success: false,
        error: 'Please set your daily progress before ending your day',
        code: 'PROGRESS_NOT_SET',
        message: 'Daily progress update is required before ending work day'
      });
    }

    const endTime = new Date();
    
    // Update attendance record
    attendanceRecord.endDayTime = endTime;
    
    if (latitude && longitude) {
      attendanceRecord.endDayLocation = {
        latitude,
        longitude,
        address,
        accuracy
      };
    }

    if (notes) {
      attendanceRecord.employeeNotes = notes;
    }

    if (deviceInfo) {
      attendanceRecord.endDayDevice = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        deviceType: deviceInfo.deviceType || 'Unknown'
      };
    }

    // Calculate working hours and update status with negative hours guard
    const startTime = attendanceRecord.startDayTime;
    const totalMilliseconds = endTime - startTime;
    const totalHours = Math.max(0, totalMilliseconds / (1000 * 60 * 60));
    const totalMinutes = Math.max(0, Math.floor(totalMilliseconds / (1000 * 60)));

    attendanceRecord.totalHoursWorked = Math.round(totalHours * 100) / 100;
    attendanceRecord.regularHours = Math.min(totalHours, 8);
    attendanceRecord.overtimeHours = Math.max(0, totalHours - 8);

    // Update status based on hours worked
    if (totalHours >= 8) {
      attendanceRecord.status = 'Present';
    } else if (totalHours >= 4) {
      attendanceRecord.status = 'Half Day';
    } else {
      attendanceRecord.status = 'Present'; // Short day but present
    }

    // Calculate daily wage and earnings
    const user = await User.findById(userId);
    const userTag = await UserTag.findOne({ user: userId });
    const dailyWage = attendanceRecord.dailyWage || 258; // Default or from salary config
    
    attendanceRecord.earnedAmount = (totalHours / 8) * dailyWage;
    if (attendanceRecord.overtimeHours > 0) {
      attendanceRecord.earnedAmount += attendanceRecord.overtimeHours * (dailyWage / 8) * 1.5;
    }

    // Mark as verified and approved
    attendanceRecord.isVerified = true;
    attendanceRecord.approvalStatus = 'Auto-Approved';
    attendanceRecord.systemNotes = `Day ended after ${attendanceRecord.totalHoursWorked} hours of work`;
    
    // Store aim completion status
    attendanceRecord.dailyAimCompleted = true;
    attendanceRecord.aimCompletionStatus = todayAim.completionStatus;
    attendanceRecord.aimCompletionComment = todayAim.completionComment;
    
    // Store progress completion status
    attendanceRecord.dailyProgressCompleted = !!todayProgress;

    await attendanceRecord.save();

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit('attendance:day-ended', {
        userId,
        userName: req.user.name,
        endTime,
        totalHours: attendanceRecord.totalHoursWorked,
        status: attendanceRecord.status,
        earnedAmount: attendanceRecord.earnedAmount
      });
    }

    res.json({
      success: true,
      message: `Day ended successfully! You worked ${attendanceRecord.totalHoursWorked} hours.`,
      data: {
        attendanceId: attendanceRecord._id,
        startTime: attendanceRecord.startDayTime,
        endTime: attendanceRecord.endDayTime,
        totalHours: attendanceRecord.totalHoursWorked,
        regularHours: attendanceRecord.regularHours,
        overtimeHours: attendanceRecord.overtimeHours,
        status: attendanceRecord.status,
        earnedAmount: Math.round(attendanceRecord.earnedAmount * 100) / 100,
        isOvertime: attendanceRecord.overtimeHours > 0,
        summary: {
          workingTime: `${Math.floor(totalHours)}h ${Math.floor((totalHours % 1) * 60)}m`,
          earnings: `₹${Math.round(attendanceRecord.earnedAmount * 100) / 100}`,
          efficiency: totalHours >= 8 ? 'Excellent' : totalHours >= 6 ? 'Good' : 'Needs Improvement'
        }
      }
    });

  } catch (error) {
    console.error('End day error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to end day',
      details: error.message 
    });
  }
});

// Get current day status
router.get('/today-status', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check for open unended session first (supports overnight sessions)
    let attendanceRecord = await DailyAttendance.findOne({
      user: userId,
      startDayTime: { $exists: true, $ne: null },
      $or: [{ endDayTime: { $exists: false } }, { endDayTime: null }]
    }).sort({ startDayTime: -1 });

    if (!attendanceRecord) {
      attendanceRecord = await DailyAttendance.findOne({
        user: userId,
        date: today
      });
    }

    if (!attendanceRecord) {
      return res.json({
        success: true,
        data: {
          hasStarted: false,
          hasEnded: false,
          canStartDay: true,
          canEndDay: false,
          status: 'Not Started',
          message: 'Ready to start your day!'
        }
      });
    }

    const hasStarted = !!attendanceRecord.startDayTime;
    const hasEnded = !!attendanceRecord.endDayTime;
    const currentTime = new Date();
    
    let currentHours = 0;
    if (hasStarted && !hasEnded) {
      currentHours = Math.max(0, (currentTime - attendanceRecord.startDayTime) / (1000 * 60 * 60));
    }

    res.json({
      success: true,
      data: {
        attendanceId: attendanceRecord._id,
        hasStarted,
        hasEnded,
        canStartDay: !hasStarted,
        canEndDay: hasStarted && !hasEnded,
        status: attendanceRecord.status,
        startTime: attendanceRecord.startDayTime,
        endTime: attendanceRecord.endDayTime,
        currentHours: hasStarted && !hasEnded ? Math.round(currentHours * 100) / 100 : attendanceRecord.totalHoursWorked,
        totalHours: attendanceRecord.totalHoursWorked,
        earnedAmount: attendanceRecord.earnedAmount,
        message: hasEnded 
          ? `Day completed! Worked ${attendanceRecord.totalHoursWorked} hours.`
          : hasStarted 
            ? `Day in progress. Current: ${Math.round(currentHours * 100) / 100} hours.`
            : 'Ready to start your day!'
      }
    });

  } catch (error) {
    console.error('Today status error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get today status',
      details: error.message 
    });
  }
});

// Get user attendance history
router.get('/history', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, page = 1, limit = 30 } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    const skip = (page - 1) * limit;

    const records = await DailyAttendance.find({
      user: userId,
      date: { $gte: start, $lte: end }
    })
    .sort({ date: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('approvedBy', 'name');

    const total = await DailyAttendance.countDocuments({
      user: userId,
      date: { $gte: start, $lte: end }
    });

    // Calculate summary statistics
    const stats = await DailyAttendance.getAttendanceStats(start, end, userId);

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        stats,
        period: { start, end }
      }
    });

  } catch (error) {
    console.error('Attendance history error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch attendance history',
      details: error.message 
    });
  }
});

// Auto-end day endpoint - DISABLED
// Work days now continue indefinitely until user manually ends them
router.post('/auto-end-day', adminAuth, async (req, res) => {
  return res.status(400).json({ 
      success: false,
    error: 'Auto end day is permanently disabled. Work days continue until manually ended by the user.',
    code: 'AUTO_END_DISABLED'
  });
});

// OLD AUTO-END DAY CODE (DISABLED):
// router.post('/auto-end-day', adminAuth, async (req, res) => {
//   try {
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     // Find all attendance records that started today but haven't ended
//     const activeAttendance = await DailyAttendance.find({
//       date: today,
//       startDayTime: { $exists: true },
//       endDayTime: { $exists: false }
//     }).populate('user', 'name email');

//     const autoEndedUsers = [];
//     const currentTime = new Date();

//     for (const record of activeAttendance) {
//       const hoursWorked = (currentTime - record.startDayTime) / (1000 * 60 * 60);

//       if (hoursWorked >= MAX_WORKING_HOURS) {
//         // Auto end the day
//         record.endDayTime = currentTime;
//         record.totalHoursWorked = Math.round(hoursWorked * 100) / 100;
//         record.regularHours = Math.min(hoursWorked, 8);
//         record.overtimeHours = Math.max(0, hoursWorked - 8);
//         record.autoEnded = true;
//         record.systemNotes = `Auto-ended after ${MAX_WORKING_HOURS} hours of work`;
//         record.approvalStatus = 'Auto-Approved';

//         // Calculate earnings
//         const dailyWage = record.dailyWage || 258;
//         record.earnedAmount = (hoursWorked / 8) * dailyWage;
//         if (record.overtimeHours > 0) {
//           record.earnedAmount += record.overtimeHours * (dailyWage / 8) * 1.5;
//         }

//         await record.save();

//         autoEndedUsers.push({
//           userId: record.user._id,
//           userName: record.user.name,
//           hoursWorked: record.totalHoursWorked,
//           autoEndTime: currentTime,
//           earnedAmount: record.earnedAmount
//         });

//         // Emit socket event
//         if (req.io) {
//           req.io.emit('attendance:auto-day-ended', {
//             userId: record.user._id,
//             userName: record.user.name,
//             endTime: currentTime,
//             hoursWorked: record.totalHoursWorked,
//             reason: 'Exceeded maximum working hours'
//           });
//         }
//       }
//     }

//     res.json({
//       success: true,
//       message: `Auto-ended ${autoEndedUsers.length} user(s)`,
//       data: {
//         autoEndedUsers,
//         maxWorkingHours: MAX_WORKING_HOURS,
//         totalActiveUsers: activeAttendance.length
//       }
//     });

//   } catch (error) {
//     console.error('Auto end day error:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to auto end day',
//       details: error.message 
//     });
//   }
// });

// Get live attendance dashboard data
router.get('/live-dashboard', auth, async (req, res) => {
  try {
    const { date, department, status } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    // Set date range for the day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build query
    let query = {
      date: { $gte: startOfDay, $lte: endOfDay }
    };

    if (department) {
      const users = await User.find({ department }).select('_id');
      query.user = { $in: users.map(u => u._id) };
    }

    if (status) {
      if (status === 'present') {
        query.isPresent = true;
      } else if (status === 'absent') {
        query.isPresent = false;
      } else if (status === 'on-leave') {
        query.isLeave = true;
      }
    }

    // Fetch attendance records with user details
    const attendance = await DailyAttendance.find(query)
      .populate('user', 'name email avatar department')
      .populate('approvedBy', 'name')
      .sort({ updatedAt: -1 })
      .lean();

    // Get all active users for comparison
    const totalUsers = await User.countDocuments({ isActive: true });
    
    // Calculate statistics
    const presentToday = attendance.filter(a => a.isPresent).length;
    const absentToday = totalUsers - presentToday;
    const onLeaveToday = attendance.filter(a => a.isLeave).length;
    const lateToday = attendance.filter(a => a.status === 'Late').length;
    const overtimeToday = attendance.filter(a => a.overtimeHours > 0).length;

    const totalHoursToday = attendance.reduce((sum, a) => sum + (a.totalHoursWorked || 0), 0);
    const avgHoursToday = presentToday > 0 ? totalHoursToday / presentToday : 0;
    const totalEarningsToday = attendance.reduce((sum, a) => sum + (a.earnedAmount || 0), 0);

    const stats = {
      totalUsers,
      presentToday,
      absentToday,
      onLeaveToday,
      lateToday,
      overtimeToday,
      presentPercentage: totalUsers > 0 ? (presentToday / totalUsers) * 100 : 0,
      avgHoursToday: Math.round(avgHoursToday * 100) / 100,
      totalHoursToday: Math.round(totalHoursToday * 100) / 100,
      totalEarningsToday: Math.round(totalEarningsToday * 100) / 100
    };

    // Format attendance data with enhanced information
    const formattedAttendance = attendance.map(record => ({
      ...record,
      statusColor: record.statusColor,
      workingHours: record.totalHoursWorked || 0,
      earnings: record.earnedAmount || 0,
      efficiency: record.totalHoursWorked >= 8 ? 'High' : record.totalHoursWorked >= 6 ? 'Medium' : 'Low'
    }));

    res.json({
      success: true,
      data: {
        attendance: formattedAttendance,
        stats,
        date: targetDate.toISOString().split('T')[0],
        lastUpdated: new Date()
      }
    });

  } catch (error) {
    console.error('Live dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live attendance data',
      details: error.message
    });
  }
});

// Calculate monthly salary for user
router.get('/salary/:userId/:year/:month', auth, async (req, res) => {
  try {
    const { userId, year, month } = req.params;

    // Verify authorization
    if (req.user.id !== userId && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized' 
      });
    }

    const calculation = await enhancedSalaryCalculator.calculateMonthlySalary(
      userId,
      parseInt(year),
      parseInt(month)
    );

    res.json({
      success: true,
      data: calculation
    });

  } catch (error) {
    console.error('Salary calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate salary',
      details: error.message
    });
  }
});

// Generate salary slip
router.get('/salary-slip/:userId/:year/:month', auth, async (req, res) => {
  try {
    const { userId, year, month } = req.params;

    // Verify authorization
    if (req.user.id !== userId && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized' 
      });
    }

    const salarySlip = await enhancedSalaryCalculator.generateSalarySlip(
      userId,
      parseInt(year),
      parseInt(month)
    );

    res.json({
      success: true,
      data: salarySlip
    });

  } catch (error) {
    console.error('Salary slip generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate salary slip',
      details: error.message
    });
  }
});

module.exports = router;