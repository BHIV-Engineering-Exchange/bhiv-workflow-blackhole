const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const DailyAttendance = require('../models/DailyAttendance');
const EmployeeMaster = require('../models/EmployeeMaster');
const User = require('../models/User');
const Department = require('../models/Department');
const Salary = require('../models/Salary');
const auth = require('../middleware/auth');

/**
 * PART E: ENHANCED DASHBOARD API
 * 
 * Improvements:
 * - Latest reconciled attendance only
 * - Merge failure highlighting
 * - Name + biometric name display
 * - Salary in INR with formatting
 * - Mismatch alerts
 */

/**
 * @route   GET /api/dashboard/attendance-summary
 * @desc    Get comprehensive attendance dashboard with merge status
 * @access  Private
 */
router.get('/attendance-summary', auth, async (req, res) => {
  try {
    const { startDate, endDate, departmentId, status } = req.query;

    const query = {};

    // Date range
    if (startDate && endDate) {
      const start = moment(startDate).tz('Asia/Kolkata').startOf('day').toDate();
      const end = moment(endDate).tz('Asia/Kolkata').endOf('day').toDate();
      query.date = { $gte: start, $lte: end };
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    let records = await DailyAttendance.find(query)
      .populate('user', 'name email department')
      .sort({ date: -1 })
      .lean(); // Use lean for better performance

    // Department filter
    if (departmentId) {
      records = records.filter(r => 
        r.user?.department?.toString() === departmentId
      );
    }

    // ✅ FIX: Bulk fetch all employees and salaries at once (eliminates N+1 problem)
    const userIds = records.map(r => r.user._id);
    const [employees, salaries] = await Promise.all([
      EmployeeMaster.find({ user: { $in: userIds } }).lean(),
      Salary.find({ user: { $in: userIds } }).sort({ month: -1 }).lean()
    ]);

    // Create lookup maps for O(1) access
    const employeeMap = new Map(employees.map(e => [e.user.toString(), e]));
    const salaryMap = new Map();
    salaries.forEach(s => {
      const userId = s.user.toString();
      if (!salaryMap.has(userId)) {
        salaryMap.set(userId, s); // Keep only the latest salary per user
      }
    });

    // Format dashboard response
    const dashboardData = records.map((record) => {
      const employee = employeeMap.get(record.user._id.toString());
      const latestSalary = salaryMap.get(record.user._id.toString());

      const mergeDetails = record.attendanceMergeDetails || {};
      const isWithinTolerance = !mergeDetails.remarks?.includes('MISMATCH_20+');
      const hasMappingIssue = !mergeDetails.case;

      return {
        _id: record._id,
        employee: {
          id: record.user._id,
          name: record.user.name,
          email: record.user.email,
          department: record.user.department,
          biometricCode: employee?.biometric_code || 'N/A'
        },
        date: moment(record.date).tz('Asia/Kolkata').format('YYYY-MM-DD'),
        attendance: {
          status: record.status,
          isPresent: record.isPresent,
          workedHours: parseFloat(record.totalHoursWorked?.toFixed(2)) || 0,
          verificationMethod: record.verificationMethod
        },
        times: {
          clockIn: record.biometricTimeIn ? moment(record.biometricTimeIn).tz('Asia/Kolkata').format('HH:mm:ss') : null,
          clockOut: record.biometricTimeOut ? moment(record.biometricTimeOut).tz('Asia/Kolkata').format('HH:mm:ss') : null
        },
        merge: {
          case: mergeDetails.case || 'UNKNOWN',
          remarks: mergeDetails.remarks || 'NOT_RECONCILED',
          isWithinTolerance: isWithinTolerance,
          timeDifferences: mergeDetails.timeDifferences || {},
          hasAlert: !isWithinTolerance || hasMappingIssue,
          alertType: !isWithinTolerance ? 'MISMATCH_20+' : hasMappingIssue ? 'MAPPING_ISSUE' : null
        },
        salary: {
          dailyRate: employee?.calculatedDailyRate || 0,
          hourlyRate: employee?.calculatedHourlyRate || 0,
          earnedToday: parseFloat((record.basicSalaryForDay || 0).toFixed(2)),
          currency: '₹',
          formattedEarnings: formatCurrency(record.basicSalaryForDay || 0)
        }
      };
    });

    // Calculate summary statistics
    const summary = calculateSummaryStats(dashboardData);

    res.json({
      success: true,
      dateRange: {
        start: startDate,
        end: endDate
      },
      summary: summary,
      records: dashboardData,
      count: dashboardData.length
    });

  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/dashboard/merge-analysis
 * @desc    Analyze merge cases and mismatch distribution
 * @access  Private
 */
router.get('/merge-analysis', auth, async (req, res) => {
  try {
    const { startDate, endDate, departmentId } = req.query;

    const query = {};

    if (startDate && endDate) {
      const start = moment(startDate).tz('Asia/Kolkata').startOf('day').toDate();
      const end = moment(endDate).tz('Asia/Kolkata').endOf('day').toDate();
      query.date = { $gte: start, $lte: end };
    }

    let records = await DailyAttendance.find(query)
      .populate('user', 'name department');

    if (departmentId) {
      records = records.filter(r => 
        r.user?.department?.toString() === departmentId
      );
    }

    // Analyze merge cases
    const analysis = {
      totalRecords: records.length,
      byMergeCase: {},
      byRemarks: {},
      mismatches: {
        total: 0,
        within20min: 0,
        beyond20min: 0
      },
      mappingIssues: 0,
      timeDifferences: {
        inDiffStats: [],
        outDiffStats: []
      }
    };

    for (const record of records) {
      const merge = record.attendanceMergeDetails || {};

      // Count by case
      const caseType = merge.case || 'UNKNOWN';
      analysis.byMergeCase[caseType] = (analysis.byMergeCase[caseType] || 0) + 1;

      // Count by remarks
      const remarks = merge.remarks || 'NOT_RECONCILED';
      analysis.byRemarks[remarks] = (analysis.byRemarks[remarks] || 0) + 1;

      // Count mismatches
      if (remarks.includes('MISMATCH')) {
        analysis.mismatches.total++;
        if (remarks.includes('20+')) {
          analysis.mismatches.beyond20min++;
        } else {
          analysis.mismatches.within20min++;
        }
      }

      // Count mapping issues
      if (!merge.case) {
        analysis.mappingIssues++;
      }

      // Collect time differences
      if (merge.timeDifferences?.inDiff !== undefined) {
        analysis.timeDifferences.inDiffStats.push(merge.timeDifferences.inDiff);
      }
      if (merge.timeDifferences?.outDiff !== undefined) {
        analysis.timeDifferences.outDiffStats.push(merge.timeDifferences.outDiff);
      }
    }

    // Calculate statistics on time differences
    const inStats = calculateStats(analysis.timeDifferences.inDiffStats);
    const outStats = calculateStats(analysis.timeDifferences.outDiffStats);

    res.json({
      success: true,
      analysis: {
        ...analysis,
        timeDifferences: {
          inDiff: inStats,
          outDiff: outStats
        }
      }
    });

  } catch (error) {
    console.error('❌ Merge analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/dashboard/employee/:userId/monthly
 * @desc    Get employee monthly attendance with salary breakdown
 * @access  Private
 */
router.get('/employee/:userId/monthly', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, month } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        error: 'Year and month are required'
      });
    }

    const startDate = moment(`${year}-${month}-01`, 'YYYY-MM-DD').tz('Asia/Kolkata').startOf('month');
    const endDate = startDate.clone().endOf('month');

    // Get attendance records
    const attendance = await DailyAttendance.find({
      user: userId,
      date: {
        $gte: startDate.toDate(),
        $lte: endDate.toDate()
      }
    }).populate('user', 'name email');

    const employee = await EmployeeMaster.findOne({ user: userId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    // Calculate monthly summary
    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let lateDays = 0;
    let totalHours = 0;
    let totalEarned = 0;
    let mismatches = 0;

    const dayRecords = [];

    for (const record of attendance) {
      const dayRecord = {
        date: moment(record.date).format('YYYY-MM-DD'),
        status: record.status,
        clockIn: record.biometricTimeIn ? moment(record.biometricTimeIn).format('HH:mm:ss') : null,
        clockOut: record.biometricTimeOut ? moment(record.biometricTimeOut).format('HH:mm:ss') : null,
        workedHours: parseFloat((record.totalHoursWorked || 0).toFixed(2)),
        earned: parseFloat((record.basicSalaryForDay || 0).toFixed(2)),
        formattedEarned: formatCurrency(record.basicSalaryForDay || 0),
        mergeRemarks: record.attendanceMergeDetails?.remarks || 'N/A'
      };

      dayRecords.push(dayRecord);

      // Update counters
      switch (record.status) {
        case 'Present':
        case 'Late':
          presentDays++;
          break;
        case 'Absent':
          absentDays++;
          break;
        case 'Half Day':
          halfDays += 0.5;
          break;
      }

      totalHours += record.totalHoursWorked || 0;
      totalEarned += record.basicSalaryForDay || 0;

      if (record.attendanceMergeDetails?.remarks?.includes('MISMATCH')) {
        mismatches++;
      }
    }

    res.json({
      success: true,
      period: {
        year: parseInt(year),
        month: parseInt(month),
        range: {
          start: startDate.format('YYYY-MM-DD'),
          end: endDate.format('YYYY-MM-DD')
        }
      },
      employee: {
        _id: employee.user,
        name: employee.name,
        salaryType: employee.salaryType,
        hourlyRate: employee.calculatedHourlyRate,
        dailyRate: employee.calculatedDailyRate
      },
      summary: {
        presentDays: presentDays,
        halfDays: halfDays,
        absentDays: absentDays,
        lateDays: lateDays,
        totalWorkingDays: presentDays + absentDays + halfDays,
        totalHours: parseFloat(totalHours.toFixed(2)),
        mergesMismatched: mismatches,
        totalEarnings: parseFloat(totalEarned.toFixed(2)),
        formattedTotalEarnings: formatCurrency(totalEarned),
        currency: '₹'
      },
      dailyRecords: dayRecords
    });

  } catch (error) {
    console.error('❌ Employee monthly error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/dashboard/mismatches
 * @desc    Get all records with > 20 min mismatch
 * @access  Private
 */
router.get('/mismatches', auth, async (req, res) => {
  try {
    const { startDate, endDate, departmentId } = req.query;

    const query = {};

    if (startDate && endDate) {
      const start = moment(startDate).tz('Asia/Kolkata').startOf('day').toDate();
      const end = moment(endDate).tz('Asia/Kolkata').endOf('day').toDate();
      query.date = { $gte: start, $lte: end };
    }

    let records = await DailyAttendance.find(query)
      .populate('user', 'name email department');

    // Filter for mismatches
    records = records.filter(r => 
      r.attendanceMergeDetails?.remarks?.includes('MISMATCH_20+')
    );

    if (departmentId) {
      records = records.filter(r => 
        r.user?.department?.toString() === departmentId
      );
    }

    const mismatchRecords = records.map(record => {
      const merge = record.attendanceMergeDetails || {};
      return {
        _id: record._id,
        employee: {
          name: record.user.name,
          email: record.user.email
        },
        date: moment(record.date).format('YYYY-MM-DD'),
        clockIn: record.biometricTimeIn ? moment(record.biometricTimeIn).format('HH:mm:ss') : null,
        clockOut: record.biometricTimeOut ? moment(record.biometricTimeOut).format('HH:mm:ss') : null,
        workedHours: parseFloat((record.totalHoursWorked || 0).toFixed(2)),
        mismatch: {
          inTimeDiff: merge.timeDifferences?.inDiff || 0,
          outTimeDiff: merge.timeDifferences?.outDiff || 0,
          remarks: merge.remarks,
          case: merge.case
        },
        alertSeverity: calculateMismatchSeverity(merge.timeDifferences)
      };
    });

    res.json({
      success: true,
      totalMismatches: mismatchRecords.length,
      records: mismatchRecords,
      summary: {
        high: mismatchRecords.filter(r => r.alertSeverity === 'HIGH').length,
        medium: mismatchRecords.filter(r => r.alertSeverity === 'MEDIUM').length,
        low: mismatchRecords.filter(r => r.alertSeverity === 'LOW').length
      }
    });

  } catch (error) {
    console.error('❌ Mismatches error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================
// HELPER FUNCTIONS
// ==========================

function formatCurrency(amount) {
  if (!amount) return '₹0.00';
  return '₹' + parseFloat(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function calculateSummaryStats(records) {
  const stats = {
    total: records.length,
    present: 0,
    absent: 0,
    halfDay: 0,
    late: 0,
    totalHours: 0,
    totalEarnings: 0,
    mismatches: {
      total: 0,
      within20: 0,
      beyond20: 0
    },
    byMergeCase: {}
  };

  for (const record of records) {
    stats[record.attendance.status.toLowerCase()]++;
    stats.totalHours += record.attendance.workedHours;
    stats.totalEarnings += record.salary.earnedToday;

    if (record.merge.hasAlert && !record.merge.isWithinTolerance) {
      stats.mismatches.total++;
      if (record.merge.alertType === 'MISMATCH_20+') {
        stats.mismatches.beyond20++;
      } else {
        stats.mismatches.within20++;
      }
    }

    const caseType = record.merge.case;
    stats.byMergeCase[caseType] = (stats.byMergeCase[caseType] || 0) + 1;
  }

  stats.totalHours = parseFloat(stats.totalHours.toFixed(2));
  stats.totalEarnings = parseFloat(stats.totalEarnings.toFixed(2));
  stats.formattedTotalEarnings = formatCurrency(stats.totalEarnings);

  return stats;
}

function calculateStats(values) {
  if (!values || values.length === 0) {
    return { min: 0, max: 0, avg: 0, count: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: parseFloat(avg.toFixed(2)),
    median: sorted.length % 2 === 0 
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)],
    count: sorted.length
  };
}

function calculateMismatchSeverity(timeDiffs) {
  if (!timeDiffs) return 'LOW';

  const maxDiff = Math.max(timeDiffs.inDiff || 0, timeDiffs.outDiff || 0);

  if (maxDiff > 60) return 'HIGH';
  if (maxDiff > 30) return 'MEDIUM';
  return 'LOW';
}

module.exports = router;
