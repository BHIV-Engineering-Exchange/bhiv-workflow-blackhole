const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const EmployeeActivity = require('../models/EmployeeActivity');

/**
 * POST /api/agent/activity/ingest
 * Receive activity data from desktop agent
 * IMPORTANT: Only accepts data when employee has an active workday
 */
router.post('/activity/ingest', auth, async (req, res) => {
  try {
    const {
      attendanceId,
      timestamp,
      mouseEvents,
      keyboardEvents,
      idleSeconds,
      activeApp,
      intervalDuration
    } = req.body;

    console.log('📥 Incoming activity data:', { attendanceId, mouseEvents, keyboardEvents, idleSeconds, intervalDuration, activeApp });

    // Validate required fields
    if (!attendanceId) {
      return res.status(400).json({
        success: false,
        error: 'Attendance ID is required'
      });
    }

    // CRITICAL: Verify day is started before accepting activity data
    const Attendance = require('../models/Attendance');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const activeDay = await Attendance.findOne({
      user: req.user.id,
      date: { $gte: today, $lt: tomorrow },
      startDayTime: { $exists: true },
      endDayTime: { $exists: false }
    });

    console.log(`📊 Activity ingestion for user ${req.user.id}: activeDay=${!!activeDay}, attendanceId=${attendanceId}`);

    if (!activeDay) {
      console.warn(`⚠️ Activity rejected: No active day found for user ${req.user.id}`);
      return res.status(403).json({ 
        success: false,
        error: 'Cannot accept activity data: workday not started',
        code: 'DAY_NOT_ACTIVE',
        hint: 'Employee must start their day first from the dashboard'
      });
    }

    // Calculate mouse activity score (0-100 based on events per minute)
    // Safety checks to prevent NaN
    const validIntervalDuration = intervalDuration && intervalDuration > 0 ? intervalDuration : 30;
    const validMouseEvents = mouseEvents || 0;
    const mouseActivityScore = (idleSeconds >= 30 || validMouseEvents === 0) 
      ? 0 
      : Math.min(100, Math.round((validMouseEvents / 20) * 100));
    
    // Create EmployeeActivity document
    const activityData = new EmployeeActivity({
      employee: req.user.id,
      timestamp: timestamp || new Date(),
      keystroke_count: keyboardEvents || 0,
      mouse_activity_score: isNaN(mouseActivityScore) ? 0 : mouseActivityScore,
      idle_duration: idleSeconds || 0,
      active_application: {
        name: activeApp || 'Unknown',
        title: activeApp || 'Unknown'
      },
      session_id: attendanceId,
      work_hours: {
        start: activeDay.startDayTime,
        end: null
      }
    });

    // Calculate productivity score
    activityData.calculateProductivityScore();

    // Save to MongoDB
    await activityData.save();

    console.log(`📊 Activity data saved to MongoDB for user ${req.user.email}:`, {
      mouseEvents,
      keyboardEvents,
      idleSeconds,
      activeApp
    });

    res.json({
      success: true,
      message: 'Activity data ingested successfully'
    });

  } catch (error) {
    console.error('Activity ingestion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ingest activity data'
    });
  }
});

/**
 * GET /api/agent/activity/summary/:userId
 * Get activity summary for a user (fetches from MongoDB)
 */
router.get('/activity/summary/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify authorization
    if (req.user.id !== userId && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch activity data from MongoDB
    const activities = await EmployeeActivity.find({
      employee: userId,
      timestamp: { $gte: today, $lt: tomorrow }
    }).sort({ timestamp: -1 });

    // Calculate summary
    const summary = {
      totalLogs: activities.length,
      totalKeystrokes: activities.reduce((sum, a) => sum + a.keystroke_count, 0),
      totalMouseActivity: activities.reduce((sum, a) => sum + a.mouse_activity_score, 0),
      totalIdleSeconds: activities.reduce((sum, a) => sum + a.idle_duration, 0),
      avgProductivityScore: activities.length > 0 
        ? Math.round(activities.reduce((sum, a) => sum + a.productivity_score, 0) / activities.length)
        : 0,
      recentLogs: activities.slice(0, 10) // Most recent 10 entries
    };

    res.json({ success: true, summary });

  } catch (error) {
    console.error('Activity summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
