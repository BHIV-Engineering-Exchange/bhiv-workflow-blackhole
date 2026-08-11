const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Attendance = require('../models/Attendance');

/**
 * GET /api/attendance/status
 * Returns current workday status for the authenticated employee
 * Used by Electron agent for polling (every 30 seconds)
 * 
 * Response:
 * {
 *   "dayStarted": true/false,
 *   "startTime": "ISO_DATE",
 *   "attendanceId": "...",
 *   "workLocation": "Office/Home"
 * }
 */
router.get('/status', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Find active unended attendance session first (supports overnight shifts)
    let attendance = await Attendance.findOne({
      user: userId,
      startDayTime: { $exists: true, $ne: null },
      $or: [{ endDayTime: { $exists: false } }, { endDayTime: null }]
    }).sort({ startDayTime: -1 }).lean();
    
    // If no active session, check today's record
    if (!attendance) {
      attendance = await Attendance.findOne({
        user: userId,
        date: {
          $gte: today,
          $lt: tomorrow
        }
      }).lean();
    }
    
    // If no record exists or day has ended
    if (!attendance || attendance.endDayTime || attendance.endTime) {
      return res.json({
        dayStarted: false,
        startTime: null,
        attendanceId: null,
        workLocation: null
      });
    }
    
    // Day is active
    return res.json({
      dayStarted: true,
      startTime: attendance.startDayTime || attendance.startTime,
      attendanceId: attendance._id,
      workLocation: attendance.workLocationType || 'Unknown',
      location: attendance.startDayLocation || attendance.location
    });
    
  } catch (error) {
    console.error('❌ Attendance status check error:', error);
    res.status(500).json({ 
      error: 'Failed to check attendance status',
      dayStarted: false 
    });
  }
});

module.exports = router;
