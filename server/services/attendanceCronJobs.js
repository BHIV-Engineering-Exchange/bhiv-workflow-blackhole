const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const DailyAttendance = require('../models/DailyAttendance');
const Aim = require('../models/Aim');
const User = require('../models/User');

// ============================================
// DAILY ATTENDANCE DATA PERSISTENCE SERVICE
// ============================================
// This service ensures attendance data is permanently stored at end of day

// WFH Maximum Hours Cap - ONLY applies to WFH employees
const WFH_MAX_HOURS_PER_DAY = 8;

/**
 * Check if a user is WFH based on workMode or workLocationType
 * @param {Object} attendance - Attendance record
 * @param {Object} user - User document (optional)
 * @returns {boolean} - True if WFH, false if WFO
 */
async function isUserWFH(attendance, user = null) {
  // Check workLocationType first
  if (attendance.workLocationType === 'Home' || attendance.workLocationType === 'Remote') {
    return true;
  }
  
  // Check workPattern
  if (attendance.workPattern === 'Remote') {
    return true;
  }
  
  // Check user's workMode
  if (user?.workMode === 'WFH') {
    return true;
  }
  
  // Fetch user workMode if not provided
  if (!user && attendance.user) {
    const userId = attendance.user._id || attendance.user;
    const userDoc = await User.findById(userId).select('workMode').lean();
    if (userDoc?.workMode === 'WFH') {
      return true;
    }
  }
  
  return false;
}

/**
 * Apply WFH hour cap if applicable
 * @param {number} hoursWorked - Calculated hours worked
 * @param {boolean} isWFH - Whether user is WFH
 * @returns {Object} - { hours: number, capped: boolean, originalHours: number }
 */
function applyWFHCap(hoursWorked, isWFH) {
  if (isWFH && hoursWorked > WFH_MAX_HOURS_PER_DAY) {
    return {
      hours: WFH_MAX_HOURS_PER_DAY,
      capped: true,
      originalHours: hoursWorked
    };
  }
  return {
    hours: hoursWorked,
    capped: false,
    originalHours: hoursWorked
  };
}

/**
 * Auto-end active work sessions and persist data to DailyAttendance
 * Runs at 11:59 PM every day
 */
function startAttendancePersistenceCron() {
  // Run at 11:59 PM every day
  cron.schedule('59 23 * * *', async () => {
    console.log('🔄 [CRON] Starting end-of-day attendance persistence...');
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Find all attendance records from today OR active open sessions starting before today
      const todayAttendance = await Attendance.find({
        $or: [
          { date: { $gte: today, $lt: tomorrow } },
          {
            startDayTime: { $exists: true, $ne: null },
            $or: [{ endDayTime: { $exists: false } }, { endDayTime: null }]
          }
        ]
      }).populate('user', 'name email department');

      // Get all AIMS from today
      const todayAims = await Aim.find({
        date: { $gte: today, $lt: tomorrow }
      });

      const aimMap = new Map();
      todayAims.forEach(aim => {
        aimMap.set(aim.user.toString(), aim);
      });

      let persistedCount = 0;
      let autoEndedCount = 0;

      for (const attendance of todayAttendance) {
        if (!attendance.user) continue;
        
        const userId = attendance.user._id;
        const aim = aimMap.get(userId.toString());
        
        // Check if this is a WFH employee
        const wfhStatus = await isUserWFH(attendance, attendance.user);
        
        // Calculate hours worked (but don't auto-end - let user manually end)
        const now = new Date();
        let endTime = attendance.endDayTime;
        let hoursWorked = attendance.hoursWorked || 0;
        let wfhCapApplied = false;
        let originalHours = 0;
        
        // Only calculate hours if day is already ended by user
        // If not ended, calculate up to current time for reporting purposes only
        if (!endTime && attendance.startDayTime) {
          // Calculate hours worked up to now (for reporting) but don't auto-end
          hoursWorked = Math.max(0, (now - attendance.startDayTime) / (1000 * 60 * 60));
          originalHours = hoursWorked;
          
          // Apply WFH cap for reporting if applicable
          if (wfhStatus) {
            const capResult = applyWFHCap(hoursWorked, true);
            hoursWorked = capResult.hours;
            wfhCapApplied = capResult.capped;
          }
          
          console.log(`ℹ️ User ${attendance.user.name} has active work day (${Math.round(hoursWorked * 100) / 100}h${wfhCapApplied ? ' WFH capped' : ''}) - waiting for manual end`);
        } else if (endTime && attendance.startDayTime) {
          // Day already ended by user - calculate final hours
          hoursWorked = Math.max(0, (endTime - attendance.startDayTime) / (1000 * 60 * 60));
          originalHours = hoursWorked;
          
          // Apply WFH cap if applicable (WFO employees keep actual hours)
          if (wfhStatus) {
            const capResult = applyWFHCap(hoursWorked, true);
            hoursWorked = capResult.hours;
            wfhCapApplied = capResult.capped;
            
            if (wfhCapApplied) {
              console.log(`📍 WFH Cap applied for ${attendance.user.name}: ${originalHours.toFixed(2)}h → ${hoursWorked}h`);
            }
          }
        }

        const sessionDate = attendance.date || today;
        const sessionDateStart = new Date(sessionDate);
        sessionDateStart.setHours(0, 0, 0, 0);
        const sessionDateEnd = new Date(sessionDateStart);
        sessionDateEnd.setDate(sessionDateEnd.getDate() + 1);

        // Create or update DailyAttendance record
        let dailyRecord = await DailyAttendance.findOne({
          user: userId,
          date: { $gte: sessionDateStart, $lt: sessionDateEnd }
        });

        // 🔧 FETCH WORK SESSION TO GET BREAK TIME (pause/resume time)
        const WorkSession = require('../models/WorkSession');
        const workSession = await WorkSession.findOne({
          employee: userId,
          date: { $gte: sessionDateStart, $lt: sessionDateEnd }
        });
        
        let breakTimeMinutes = 0;
        if (workSession && workSession.totalBreakTime) {
          breakTimeMinutes = workSession.totalBreakTime;
          console.log(`⏸️ Found ${breakTimeMinutes} minutes of break time for user ${attendance.user.name}`);
        }

        // Prepare system notes for WFH cap if applied
        const wfhNote = wfhCapApplied 
          ? `[WFH Cap: ${originalHours.toFixed(2)}h → ${hoursWorked}h]` 
          : '';

        if (!dailyRecord) {
          // Create new daily record
          dailyRecord = new DailyAttendance({
            user: userId,
            date: sessionDate,
            startDayTime: attendance.startDayTime,
            endDayTime: endTime,
            totalHoursWorked: Math.round(hoursWorked * 100) / 100,
            breakTime: breakTimeMinutes, // Include break time from work session
            workLocationType: attendance.workLocationType || (wfhStatus ? 'Home' : 'Office'),
            startDayLocation: attendance.startDayLocation,
            endDayLocation: attendance.endDayLocation,
            isPresent: !!attendance.startDayTime,
            status: attendance.startDayTime ? 'Present' : 'Absent',
            verificationMethod: attendance.verificationMethod || 'manual',
            dailyProgressCompleted: !!attendance.progressSubmitted,
            dailyAimCompleted: aim ? (aim.completionStatus !== 'Pending') : false,
            aimCompletionStatus: aim?.completionStatus || 'Not Set',
            aimCompletionComment: aim?.completionComment || '',
            autoEnded: attendance.autoEnded || false,
            spamStatus: (attendance.autoEnded) ? 'Pending Review' : 'Valid',
            spamReason: (attendance.autoEnded) ? (attendance.spamReason || 'Auto-ended by system') : undefined,
            systemNotes: wfhNote || undefined,
            // WFH employees have no overtime (capped at 8h)
            overtimeHours: wfhStatus ? 0 : Math.max(0, hoursWorked - 8),
            remoteHours: wfhStatus ? hoursWorked : 0,
            officeHours: wfhStatus ? 0 : hoursWorked
          });
        } else {
          // Update existing record
          dailyRecord.endDayTime = endTime;
          dailyRecord.totalHoursWorked = Math.round(hoursWorked * 100) / 100;
          dailyRecord.breakTime = breakTimeMinutes; // Include break time from work session
          dailyRecord.endDayLocation = attendance.endDayLocation;
          dailyRecord.dailyProgressCompleted = !!attendance.progressSubmitted;
          dailyRecord.dailyAimCompleted = aim ? (aim.completionStatus !== 'Pending') : false;
          dailyRecord.aimCompletionStatus = aim?.completionStatus || 'Not Set';
          dailyRecord.aimCompletionComment = aim?.completionComment || '';
          dailyRecord.autoEnded = attendance.autoEnded || false;
          dailyRecord.spamStatus = (attendance.autoEnded) ? 'Pending Review' : 'Valid';
          if (attendance.autoEnded && attendance.spamReason) {
            dailyRecord.spamReason = attendance.spamReason;
          }
          // Update WFH-specific fields
          if (wfhCapApplied) {
            dailyRecord.systemNotes = (dailyRecord.systemNotes || '') + ' ' + wfhNote;
          }
          dailyRecord.overtimeHours = wfhStatus ? 0 : Math.max(0, hoursWorked - 8);
          if (wfhStatus) {
            dailyRecord.remoteHours = hoursWorked;
            dailyRecord.officeHours = 0;
            dailyRecord.workLocationType = 'Home';
          }
        }

        await dailyRecord.save();
        persistedCount++;
      }

      // Handle employees who didn't start their day (mark as absent)
      const activeUsers = await User.find({ stillExist: 1 }).select('_id');
      const attendedUserIds = new Set(todayAttendance.map(a => a.user._id.toString()));
      
      for (const user of activeUsers) {
        const userId = user._id.toString();
        if (!attendedUserIds.has(userId)) {
          // Check if they have an AIM (present via AIM only)
          const aim = aimMap.get(userId);
          
          let dailyRecord = await DailyAttendance.findOne({
            user: user._id,
            date: { $gte: today, $lt: tomorrow }
          });

          if (!dailyRecord) {
            // Create absent record (unless they have AIMS)
            const isPresent = !!aim;
            dailyRecord = new DailyAttendance({
              user: user._id,
              date: today,
              isPresent: isPresent,
              status: isPresent ? 'Present' : 'Absent',
              totalHoursWorked: 0,
              dailyAimCompleted: aim ? (aim.completionStatus !== 'Pending') : false,
              aimCompletionStatus: aim?.completionStatus || 'Not Set',
              workLocationType: 'Not Applicable'
            });
            
            await dailyRecord.save();
            persistedCount++;
          }
        }
      }

      console.log(`✅ [CRON] End-of-day persistence complete:`);
      console.log(`   - ${persistedCount} DailyAttendance records persisted`);
      console.log(`   - Note: Auto-end day is disabled - users must manually end their work day`);
      
    } catch (error) {
      console.error('❌ [CRON] Error in attendance persistence:', error);
    }
  });

  console.log('📅 Attendance persistence cron job scheduled (11:59 PM daily)');
}

/**
 * Sync existing attendance records to DailyAttendance (run on server start)
 * Enhanced to sync ALL available data and backfill historical records
 */
async function syncExistingAttendance() {
  try {
    console.log('🔄 Syncing existing attendance records to DailyAttendance...');
    
    // Get the last 90 days of attendance (extended from 30 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    ninetyDaysAgo.setHours(0, 0, 0, 0);
    
    // Get earliest attendance record date (for completeness)
    const earliestAttendance = await Attendance.findOne()
      .sort({ date: 1 })
      .select('date')
      .lean();
    
    const startDate = earliestAttendance ? new Date(earliestAttendance.date) : ninetyDaysAgo;
    startDate.setHours(0, 0, 0, 0);
    
    console.log(`📅 Syncing attendance from ${startDate.toISOString().split('T')[0]} to today...`);
    
    const attendanceRecords = await Attendance.find({
      date: { $gte: startDate }
    }).populate('user', '_id name email');

    let syncedCount = 0;
    let skippedCount = 0;
    
    for (const attendance of attendanceRecords) {
      if (!attendance.user) continue;
      
      const dateStart = new Date(attendance.date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(dateStart);
      dateEnd.setDate(dateEnd.getDate() + 1);
      
      // Check if DailyAttendance already exists
      const existing = await DailyAttendance.findOne({
        user: attendance.user._id,
        date: { $gte: dateStart, $lt: dateEnd }
      });
      
      if (existing) {
        skippedCount++;
        continue;
      }
      
      // Calculate hours even if day is not ended (current time if not ended)
      let hoursWorked = 0;
      let endTime = attendance.endDayTime;
      
      if (attendance.startDayTime) {
        // If no end-day, use current time for ongoing sessions
        if (!endTime) {
          const now = new Date();
          const dayStart = new Date(attendance.date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);
          
          // Only count hours if still on same day
          if (now < dayEnd) {
            endTime = now;
          } else {
            // Use end of day if session spans multiple days
            endTime = dayEnd;
          }
        }
        
        hoursWorked = (endTime - attendance.startDayTime) / (1000 * 60 * 60);
        hoursWorked = Math.max(0, hoursWorked); // Ensure non-negative
      }
      
      // Create DailyAttendance record
      const dailyRecord = new DailyAttendance({
        user: attendance.user._id,
        date: attendance.date,
        startDayTime: attendance.startDayTime,
        endDayTime: endTime,
        totalHoursWorked: Math.round(hoursWorked * 100) / 100,
        workLocationType: attendance.workLocationType || 'Office',
        startDayLocation: attendance.startDayLocation,
        endDayLocation: attendance.endDayLocation,
        isPresent: !!attendance.startDayTime,
        status: attendance.startDayTime ? 'Present' : 'Absent',
        verificationMethod: attendance.verificationMethod || 'manual'
      });
      
      await dailyRecord.save();
      syncedCount++;
    }
    
    console.log(`✅ Synced ${syncedCount} historical attendance records (${skippedCount} already synced)`);
    
  } catch (error) {
    console.error('❌ Error syncing existing attendance:', error);
  }
}

/**
 * Force sync attendance records for a specific date range
 * Can be called manually or on demand
 */
async function forceSyncAttendanceRange(startDate, endDate) {
  try {
    console.log(`🔄 Force syncing attendance from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`);
    
    const attendanceRecords = await Attendance.find({
      date: { $gte: startDate, $lte: endDate }
    }).populate('user', '_id name email');

    let syncedCount = 0;
    
    for (const attendance of attendanceRecords) {
      if (!attendance.user) continue;
      
      const dateStart = new Date(attendance.date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(dateStart);
      dateEnd.setDate(dateEnd.getDate() + 1);
      
      // Check if DailyAttendance already exists
      let existing = await DailyAttendance.findOne({
        user: attendance.user._id,
        date: { $gte: dateStart, $lt: dateEnd }
      });
      
      // Calculate hours even if day is not ended
      let hoursWorked = 0;
      let endTime = attendance.endDayTime;
      
      if (attendance.startDayTime) {
        if (!endTime) {
          const now = new Date();
          const dayStart = new Date(attendance.date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);
          
          if (now < dayEnd) {
            endTime = now;
          } else {
            endTime = dayEnd;
          }
        }
        
        hoursWorked = (endTime - attendance.startDayTime) / (1000 * 60 * 60);
        hoursWorked = Math.max(0, hoursWorked);
      }
      
      if (existing) {
        // Update existing record
        existing.startDayTime = attendance.startDayTime;
        existing.endDayTime = endTime;
        existing.totalHoursWorked = Math.round(hoursWorked * 100) / 100;
        existing.workLocationType = attendance.workLocationType || 'Office';
        existing.startDayLocation = attendance.startDayLocation;
        existing.endDayLocation = attendance.endDayLocation;
        existing.isPresent = !!attendance.startDayTime;
        existing.status = attendance.startDayTime ? 'Present' : 'Absent';
        existing.verificationMethod = attendance.verificationMethod || 'manual';
        await existing.save();
      } else {
        // Create new record
        const dailyRecord = new DailyAttendance({
          user: attendance.user._id,
          date: attendance.date,
          startDayTime: attendance.startDayTime,
          endDayTime: endTime,
          totalHoursWorked: Math.round(hoursWorked * 100) / 100,
          workLocationType: attendance.workLocationType || 'Office',
          startDayLocation: attendance.startDayLocation,
          endDayLocation: attendance.endDayLocation,
          isPresent: !!attendance.startDayTime,
          status: attendance.startDayTime ? 'Present' : 'Absent',
          verificationMethod: attendance.verificationMethod || 'manual'
        });
        await dailyRecord.save();
      }
      
      syncedCount++;
    }
    
    console.log(`✅ Force sync complete: ${syncedCount} records processed`);
    return syncedCount;
    
  } catch (error) {
    console.error('❌ Error in force sync:', error);
    throw error;
  }
}

module.exports = {
  startAttendancePersistenceCron,
  syncExistingAttendance,
  forceSyncAttendanceRange
};
