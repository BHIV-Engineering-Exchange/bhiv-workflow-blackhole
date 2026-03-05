const express = require('express');
const router = express.Router();
const Aim = require('../models/Aim');
const Progress = require('../models/Progress');
const Attendance = require('../models/Attendance');
const DailyAttendance = require('../models/DailyAttendance');
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Helper to get branch filter from request headers
const getBranchQuery = (req) => {
  const selectedBranch = req.headers['x-branch'] || req.query.branch;
  if (selectedBranch && selectedBranch !== 'all') {
    return { branch: selectedBranch };
  }
  return {};
};

// @route   GET /api/enhanced-aims/with-progress
// @desc    Get enhanced aims with progress data and proper department handling - FILTERED BY BRANCH
// @access  Private (Admin only for all aims, users for their own)
router.get('/with-progress', auth, async (req, res) => {
  try {
    const { department, date, user } = req.query;
    const branchQuery = getBranchQuery(req);
    console.log('🔍 Enhanced aims query params:', { department, date, user, branch: branchQuery.branch });
    console.log('👤 Request user:', { id: req.user.id, role: req.user.role });

    // Build filter object for aims
    const aimFilter = {};
    
    // 🔒 SECURITY: Non-admin users can only see their own aims
    if (req.user.role !== 'Admin') {
      aimFilter.user = req.user.id;
      console.log('🔒 Non-admin user - filtering by user ID:', req.user.id);
    } else {
      // Admin can filter by department, branch, and specific user
      const userFilter = { stillExist: 1, ...branchQuery };
      
      if (department && department !== "all") {
        userFilter.department = department;
      }
      
      // Get users matching the filter (branch + optional department)
      const usersMatching = await User.find(userFilter).select('_id');
      if (usersMatching.length > 0) {
        aimFilter.user = { $in: usersMatching.map(u => u._id) };
      } else {
        // No users matching filter, return empty result
        return res.json({
          success: true,
          data: []
        });
      }
      if (user) aimFilter.user = user;
      console.log('👑 Admin user - applying filters:', { department, user, branch: branchQuery.branch });
    }
    
    let queryDate = new Date();
    if (date) {
      queryDate = new Date(date);
    }
    
    const startOfDay = new Date(queryDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(queryDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    aimFilter.date = {
      $gte: startOfDay,
      $lte: endOfDay
    };

    // 🧹 FILTER OUT DEFAULT AIMS: Exclude auto-generated default aims
    aimFilter.aims = { $ne: 'Daily work objectives - to be updated' };

    console.log('🎯 Final aim filter:', aimFilter);

    // 🏢 DEPARTMENT FIX: Properly populate user with department - FILTERED BY BRANCH
    const aims = await Aim.find(aimFilter)
      .populate({
        path: "user",
        select: "name email department branch",
        match: branchQuery.branch ? { branch: branchQuery.branch } : {},
        populate: {
          path: "department",
          select: "name color"
        }
      })
      .sort({ date: -1 });

    // Filter out aims where user didn't populate (not in branch)
    const filteredAims = aims.filter(aim => aim.user !== null);

    console.log(`📊 Found ${filteredAims.length} aims for date ${queryDate.toISOString().split('T')[0]}`);

    // Log department info for debugging
    filteredAims.forEach(aim => {
      console.log(`👤 User: ${aim.user?.name}, Department: ${aim.user?.department?.name || 'No Department'}`);
    });

    // Enhance each aim with progress and attendance data
    const enhancedAims = await Promise.all(filteredAims.map(async (aim) => {
      const aimObj = aim.toObject();
      console.log(`🔄 Processing aim for user: ${aim.user?.name} (${aim.user?._id})`);

      // Use the same date range for progress search
      const progressFilter = {
        user: aim.user._id,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      };

      // Get all progress entries for this user on this date
      const progressEntries = await Progress.find(progressFilter)
        .populate("task", "title description")
        .sort({ date: -1 });

      console.log(`📈 Found ${progressEntries.length} progress entries for user ${aim.user?.name}`);

      // Get attendance data for work session info
      const attendanceData = await Attendance.findOne({
        user: aim.user._id,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });

      // Get daily attendance data (enhanced model)
      const dailyAttendanceData = await DailyAttendance.findOne({
        user: aim.user._id,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });

      // Calculate aggregated progress data
      let totalProgressPercentage = 0;
      let allNotes = [];
      let allAchievements = [];
      let allBlockers = [];

      if (progressEntries.length > 0) {
        // Get the latest progress percentage
        totalProgressPercentage = progressEntries[0].progressPercentage || 0;
        
        // Collect all notes, achievements, and blockers
        progressEntries.forEach(entry => {
          if (entry.notes && entry.notes.trim()) allNotes.push(entry.notes.trim());
          if (entry.achievements && entry.achievements.trim()) allAchievements.push(entry.achievements.trim());
          if (entry.blockers && entry.blockers.trim()) allBlockers.push(entry.blockers.trim());
        });
      }

      // Update work session info from attendance data
      let workSessionInfo = aimObj.workSessionInfo || {};
      
      if (attendanceData) {
        workSessionInfo = {
          ...workSessionInfo,
          startDayTime: attendanceData.startDayTime,
          endDayTime: attendanceData.endDayTime,
          totalHoursWorked: attendanceData.hoursWorked || 0,
          workLocationTag: attendanceData.workPattern === 'Remote' ? 'WFH' : 'Office'
        };
      }

      if (dailyAttendanceData) {
        workSessionInfo = {
          ...workSessionInfo,
          startDayTime: dailyAttendanceData.startDayTime || workSessionInfo.startDayTime,
          endDayTime: dailyAttendanceData.endDayTime || workSessionInfo.endDayTime,
          totalHoursWorked: dailyAttendanceData.totalHoursWorked || workSessionInfo.totalHoursWorked,
          workLocationTag: dailyAttendanceData.workLocationType === 'Home' ? 'WFH' : 
                          dailyAttendanceData.workLocationType === 'Remote' ? 'Remote' : 'Office'
        };
      }

      // Determine if aim is pending based on progress
      const isPending = progressEntries.length === 0 || 
                       (progressEntries.length > 0 && totalProgressPercentage === 0 && 
                        allNotes.length === 0 && allAchievements.length === 0);

      return {
        ...aimObj,
        // 🏢 DEPARTMENT FIX: Use user's department as the primary department
        department: aim.user?.department || aimObj.department || null,
        // Update progress data from actual progress entries
        progressPercentage: totalProgressPercentage,
        progressNotes: allNotes.join('; '),
        achievements: allAchievements.join('; '),
        blockers: allBlockers.join('; '),
        workSessionInfo,
        // Add raw progress entries for detailed view
        progressEntries: progressEntries,
        // Add attendance data
        attendanceData: attendanceData,
        dailyAttendanceData: dailyAttendanceData,
        // Determine if aim is pending based on progress
        isPending: isPending
      };
    }));

    console.log(`✅ Returning ${enhancedAims.length} enhanced aims`);

    res.json({
      success: true,
      data: enhancedAims
    });

  } catch (error) {
    console.error("❌ Error fetching enhanced aims:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch enhanced aims",
      details: error.message 
    });
  }
});

// @route   POST /api/enhanced-aims/sync-progress-to-aim
// @desc    Sync progress data to aim automatically
// @access  Private
router.post('/sync-progress-to-aim', auth, async (req, res) => {
  try {
    const { userId, progressPercentage, notes, achievements, blockers } = req.body;
    
    // 🔒 SECURITY: Ensure user can only sync their own progress
    if (req.user.id !== userId && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized to sync progress for this user' });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find today's aim (exclude default aims)
    let todayAim = await Aim.findOne({
      user: userId,
      date: {
        $gte: today,
        $lt: tomorrow
      },
      aims: { $ne: 'Daily work objectives - to be updated' }
    });

    if (todayAim) {
      // Update aim with progress information
      todayAim.progressPercentage = progressPercentage || todayAim.progressPercentage;
      todayAim.progressNotes = notes || todayAim.progressNotes;
      todayAim.achievements = achievements || todayAim.achievements;
      todayAim.blockers = blockers || todayAim.blockers;
      
      await todayAim.save();

      // Emit socket event
      if (req.io) {
        req.io.emit("aim-updated", {
          aim: todayAim,
          user: { id: userId }
        });
      }

      res.json({
        success: true,
        message: "Progress synced to aim successfully",
        aim: todayAim
      });
    } else {
      res.json({
        success: false,
        message: "No valid aim found for today. User should set their aim first.",
        code: 'NO_AIM_FOUND'
      });
    }

  } catch (error) {
    console.error("Error syncing progress to aim:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to sync progress to aim",
      details: error.message 
    });
  }
});

// @route   POST /api/enhanced-aims/sync-attendance-to-aim
// @desc    Sync attendance data to aim automatically
// @access  Private
router.post('/sync-attendance-to-aim', auth, async (req, res) => {
  try {
    const { userId, startDayTime, endDayTime, workLocation, totalHoursWorked } = req.body;
    
    // 🔒 SECURITY: Ensure user can only sync their own attendance
    if (req.user.id !== userId && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized to sync attendance for this user' });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find today's aim (exclude default aims)
    let todayAim = await Aim.findOne({
      user: userId,
      date: {
        $gte: today,
        $lt: tomorrow
      },
      aims: { $ne: 'Daily work objectives - to be updated' }
    });

    if (todayAim) {
      // Update aim with attendance information
      if (workLocation) todayAim.workLocation = workLocation;
      
      // Update work session info
      todayAim.workSessionInfo = {
        ...todayAim.workSessionInfo,
        startDayTime: startDayTime || todayAim.workSessionInfo?.startDayTime,
        endDayTime: endDayTime || todayAim.workSessionInfo?.endDayTime,
        totalHoursWorked: totalHoursWorked || todayAim.workSessionInfo?.totalHoursWorked || 0,
        workLocationTag: workLocation === 'Home' ? 'WFH' : 
                        workLocation === 'Remote' ? 'Remote' : 'Office'
      };
      
      await todayAim.save();

      // Emit socket event
      if (req.io) {
        req.io.emit("aim-updated", {
          aim: todayAim,
          user: { id: userId }
        });
      }

      res.json({
        success: true,
        message: "Attendance synced to aim successfully",
        aim: todayAim
      });
    } else {
      res.json({
        success: false,
        message: "No valid aim found for today. User should set their aim first.",
        code: 'NO_AIM_FOUND'
      });
    }

  } catch (error) {
    console.error("Error syncing attendance to aim:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to sync attendance to aim",
      details: error.message 
    });
  }
});

// @route   GET /api/enhanced-aims/enhanced
// @desc    Get enhanced aims with all related data
// @access  Private
router.get('/enhanced', auth, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const branchQuery = getBranchQuery(req);
    
    // Set date range for the day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build filter based on user role
    let aimFilter = {
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      aims: { $ne: 'Daily work objectives - to be updated' } // Exclude default aims
    };

    // Non-admin users can only see their own aims
    if (req.user.role !== 'Admin') {
      aimFilter.user = req.user.id;
    } else if (branchQuery.branch) {
      // Admin: Filter by branch
      const usersInBranch = await User.find({ ...branchQuery, stillExist: 1 }).select('_id');
      if (usersInBranch.length > 0) {
        aimFilter.user = { $in: usersInBranch.map(u => u._id) };
      } else {
        return res.json({ success: true, data: [] });
      }
    }

    // Fetch aims with user and department data - FILTERED BY BRANCH
    const aims = await Aim.find(aimFilter)
      .populate({
        path: 'user',
        select: 'name email avatar department branch',
        match: branchQuery.branch ? { branch: branchQuery.branch } : {},
        populate: {
          path: 'department',
          select: 'name color'
        }
      })
      .lean();
    
    // Filter out aims where user didn't populate (not in branch)
    const filteredAims = aims.filter(aim => aim.user !== null);

    // Fetch all progress for the date
    const progressFilter = {
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    };
    
    if (req.user.role !== 'Admin') {
      progressFilter.user = req.user.id;
    }

    const progress = await Progress.find(progressFilter).lean();

    // Fetch attendance data
    const attendanceFilter = {
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    };
    
    if (req.user.role !== 'Admin') {
      attendanceFilter.user = req.user.id;
    }

    const attendance = await DailyAttendance.find(attendanceFilter).lean();

    // Create maps for quick lookup
    const progressMap = new Map();
    progress.forEach(p => {
      const userId = p.user.toString();
      if (!progressMap.has(userId)) {
        progressMap.set(userId, []);
      }
      progressMap.get(userId).push(p);
    });

    const attendanceMap = new Map();
    attendance.forEach(a => {
      const userId = a.user.toString();
      attendanceMap.set(userId, a);
    });

    // Combine aims with related data
    const enhancedAims = filteredAims.map(aim => {
      const userId = aim.user._id.toString();
      const userProgress = progressMap.get(userId) || [];
      const userAttendance = attendanceMap.get(userId);

      // Calculate aggregated progress data
      let totalProgressPercentage = 0;
      let allNotes = [];
      let allAchievements = [];
      let allBlockers = [];

      if (userProgress.length > 0) {
        // Get the latest progress percentage
        totalProgressPercentage = userProgress[0].progressPercentage || 0;
        
        // Collect all notes, achievements, and blockers
        userProgress.forEach(entry => {
          if (entry.notes && entry.notes.trim()) allNotes.push(entry.notes.trim());
          if (entry.achievements && entry.achievements.trim()) allAchievements.push(entry.achievements.trim());
          if (entry.blockers && entry.blockers.trim()) allBlockers.push(entry.blockers.trim());
        });
      }

      return {
        ...aim,
        // Use user's department as primary department
        department: aim.user?.department || aim.department || null,
        // Related progress data
        relatedProgress: userProgress,
        progressPercentage: totalProgressPercentage,
        progressNotes: allNotes.join('; '),
        achievements: allAchievements.join('; '),
        blockers: allBlockers.join('; '),
        // Related attendance data
        relatedAttendance: userAttendance,
        actualWorkLocation: userAttendance?.workLocationType || aim.workLocation || 'Office',
        attendanceStatus: userAttendance?.status || 'Not Started',
        startDayTime: userAttendance?.startDayTime,
        endDayTime: userAttendance?.endDayTime,
        totalHoursWorked: userAttendance?.totalHoursWorked || 0,
        // Work session info
        relatedWorkSession: userAttendance ? {
          startDayTime: userAttendance.startDayTime,
          endDayTime: userAttendance.endDayTime,
          totalHoursWorked: userAttendance.totalHoursWorked || 0,
          workLocationTag: userAttendance.workLocationType === 'Home' ? 'WFH' : 
                          userAttendance.workLocationType === 'Remote' ? 'Remote' : 'Office'
        } : null,
        // Determine if pending
        isPending: userProgress.length === 0 || 
                  (userProgress.length > 0 && totalProgressPercentage === 0 && 
                   allNotes.length === 0 && allAchievements.length === 0)
      };
    });

    res.json({
      success: true,
      data: enhancedAims,
      date: targetDate.toISOString().split('T')[0]
    });

  } catch (error) {
    console.error('Error fetching enhanced aims:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced aims data',
      details: error.message
    });
  }
});

module.exports = router;