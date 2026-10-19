const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const SalaryAttendance = require('../models/SalaryAttendance');
const Feedback = require('../models/Feedback');
const SalaryAdjustment = require('../models/SalaryAdjustment');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { Parser } = require('json2csv');
const { compareBySurname } = require('../utils/nameSorting');

// Configure multer for Excel file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'uploads/salary/';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  }
});

// Helper functions for salary calculations
const getWorkingDaysInMonth = (monthYear) => {
  try {
    const startOfMonth = moment(monthYear, 'YYYY-MM').startOf('month');
    const endOfMonth = moment(monthYear, 'YYYY-MM').endOf('month');
    
    let workingDays = 0;
    let currentDate = startOfMonth.clone();
    
    while (currentDate.isSameOrBefore(endOfMonth)) {
      // Sunday is 0 in moment.js
      if (currentDate.day() !== 0) {
        workingDays++;
      }
      currentDate.add(1, 'day');
    }
    
    return workingDays;
  } catch (error) {
    console.error('Error calculating working days:', error);
    return 26; // Default fallback
  }
};

const calculateSalaryWithDailyWage = (hoursWorked, daysPresent, monthYear, dailyWage = 258) => {
  try {
    const workingDaysInMonth = getWorkingDaysInMonth(monthYear);
    const requiredDays = Math.min(workingDaysInMonth, 26); // Max 26 working days as per requirement

    // Calculate expected hours (8 hours per working day)
    const expectedHoursPerDay = 8;
    const expectedTotalHours = requiredDays * expectedHoursPerDay;

    // Calculate effective days present by dividing total hours by 8
    const effectiveDaysPresent = hoursWorked / 8;

    // Calculate salary based on effective days present (daily wage system)
    const calculatedSalary = Math.round(effectiveDaysPresent * dailyWage);

    // Calculate percentages
    const attendancePercentage = (effectiveDaysPresent / requiredDays) * 100;
    const hoursPercentage = (hoursWorked / expectedTotalHours) * 100;

    // Calculate daily and monthly hour averages
    const avgHoursPerDay = effectiveDaysPresent > 0 ? hoursWorked / effectiveDaysPresent : 0;
    const avgHoursPerMonth = hoursWorked;

    return {
      workingDaysInMonth,
      requiredDays,
      daysPresent: Math.round(effectiveDaysPresent * 100) / 100,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      expectedTotalHours,
      avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
      avgHoursPerMonth: Math.round(avgHoursPerMonth * 100) / 100,
      dailyWage,
      attendancePercentage: Math.round(attendancePercentage * 100) / 100,
      hoursPercentage: Math.round(hoursPercentage * 100) / 100,
      salaryPercentage: Math.round(attendancePercentage * 100) / 100,
      calculatedSalary: Math.max(0, calculatedSalary),
      adjustedSalary: Math.max(0, calculatedSalary)
    };
  } catch (error) {
    console.error('Error calculating salary with daily wage:', error);
    // Fallback calculation
    const requiredDays = 26;
    const expectedTotalHours = requiredDays * 8;
    const effectiveDaysPresent = hoursWorked / 8;
    const calculatedSalary = Math.round(effectiveDaysPresent * dailyWage);
    const avgHoursPerDay = effectiveDaysPresent > 0 ? hoursWorked / effectiveDaysPresent : 0;

    return {
      workingDaysInMonth: 26,
      requiredDays,
      daysPresent: Math.round(effectiveDaysPresent * 100) / 100,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      expectedTotalHours,
      avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
      avgHoursPerMonth: Math.round(hoursWorked * 100) / 100,
      dailyWage,
      attendancePercentage: (effectiveDaysPresent / requiredDays) * 100,
      hoursPercentage: (hoursWorked / expectedTotalHours) * 100,
      salaryPercentage: (effectiveDaysPresent / requiredDays) * 100,
      calculatedSalary: Math.max(0, calculatedSalary),
      adjustedSalary: Math.max(0, calculatedSalary)
    };
  }
};

// Upload and process attendance Excel file for salary calculation
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    console.log('Salary management upload route called');
    console.log('Request file:', req.file);

    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ message: 'No Excel file uploaded' });
    }

    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    console.log('Processing file:', req.file.path);

    // Process Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log('Raw data sample:', rawData.slice(0, 3));

    if (!rawData || rawData.length < 2) {
      return res.status(400).json({ message: 'No valid data found in Excel file' });
    }

    // Process the data
    const headerRow = rawData[0];
    const dataRows = rawData.slice(1);

    // Find column indices
    const nameColIndex = headerRow.findIndex(col => 
      col && col.toString().toLowerCase().includes('name')
    );
    const deptColIndex = headerRow.findIndex(col => 
      col && col.toString().toLowerCase().includes('dept')
    );

    if (nameColIndex === -1) {
      return res.status(400).json({ message: 'Name column not found in Excel file' });
    }

    // Process attendance data
    const processedEmployees = [];
    const currentMonthYear = moment().format('YYYY-MM');

    // Clear existing data for current month
    await SalaryAttendance.deleteMany({ monthYear: currentMonthYear });

    for (const row of dataRows) {
      if (!row[nameColIndex]) continue;

      const name = row[nameColIndex].toString().trim();
      const dept = deptColIndex !== -1 ? (row[deptColIndex] || 'General').toString().trim() : 'General';

      // Find corresponding user
      const user = await User.findOne({
        name: { $regex: new RegExp(name, 'i') }
      });

      if (!user) {
        console.log(`User not found: ${name}`);
        continue;
      }

      // Calculate attendance from date columns (assuming columns after dept are dates)
      let totalHours = 0;
      let daysPresent = 0;
      const attendanceDetails = [];

      // Process date columns (starting after dept column)
      const startCol = Math.max(nameColIndex, deptColIndex) + 1;
      for (let i = startCol; i < row.length && i < headerRow.length; i++) {
        const dateHeader = headerRow[i];
        const attendanceValue = row[i];

        if (!dateHeader || !attendanceValue) continue;

        // Parse attendance value
        let hoursWorked = 0;
        let status = 'Absent';

        if (typeof attendanceValue === 'string') {
          const value = attendanceValue.toLowerCase().trim();
          if (value.includes('present') || value === 'p' || value === '1') {
            hoursWorked = 8;
            status = 'Present';
            daysPresent++;
          } else if (value.includes('half') || value === 'h' || value === '0.5') {
            hoursWorked = 4;
            status = 'Half Day';
            daysPresent += 0.5;
          }
        } else if (typeof attendanceValue === 'number') {
          hoursWorked = attendanceValue;
          if (hoursWorked >= 6) {
            status = 'Present';
            daysPresent++;
          } else if (hoursWorked >= 4) {
            status = 'Half Day';
            daysPresent += 0.5;
          }
        }

        totalHours += hoursWorked;
        attendanceDetails.push({
          date: dateHeader.toString(),
          checkIn: status === 'Present' ? '09:00' : '',
          checkOut: status === 'Present' ? '18:00' : '',
          hoursWorked,
          status
        });
      }

      // Calculate salary
      const dailyWage = 258;
      const salaryCalculation = calculateSalaryWithDailyWage(totalHours, daysPresent, currentMonthYear, dailyWage);

      // Create salary attendance record
      const salaryRecord = new SalaryAttendance({
        userId: user._id.toString(),
        employeeId: user._id.toString(),
        name,
        dept,
        daysPresent: salaryCalculation.daysPresent,
        hoursWorked: salaryCalculation.hoursWorked,
        totalWorkingDays: salaryCalculation.requiredDays,
        workingDaysInMonth: salaryCalculation.workingDaysInMonth,
        expectedTotalHours: salaryCalculation.expectedTotalHours,
        avgHoursPerDay: salaryCalculation.avgHoursPerDay,
        avgHoursPerMonth: salaryCalculation.avgHoursPerMonth,
        dailyWage: salaryCalculation.dailyWage,
        baseSalary: 8000,
        calculatedSalary: salaryCalculation.calculatedSalary,
        adjustedSalary: salaryCalculation.adjustedSalary,
        salaryPercentage: salaryCalculation.salaryPercentage,
        hoursPercentage: salaryCalculation.hoursPercentage,
        attendancePercentage: salaryCalculation.attendancePercentage,
        attendanceDetails,
        monthYear: currentMonthYear,
        exposed: false
      });

      await salaryRecord.save();
      processedEmployees.push(salaryRecord);
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    console.log(`Successfully processed ${processedEmployees.length} salary records`);

    res.json({
      success: true,
      message: `Successfully processed ${processedEmployees.length} employee records`,
      data: processedEmployees,
      monthYear: currentMonthYear
    });

  } catch (error) {
    console.error('Salary management upload error:', error);

    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      message: 'Error processing Excel file',
      error: error.message
    });
  }
});

// Get all salary attendance records
router.get('/', auth, async (req, res) => {
  try {
    const { monthYear, exposed } = req.query;
    let query = {};

    if (monthYear) {
      query.monthYear = monthYear;
    }

    // If user is not admin, only show exposed data for their own records
    if (req.user.role !== 'Admin') {
      query.userId = req.user.id;
      query.exposed = true;
    } else if (exposed !== undefined) {
      query.exposed = exposed === 'true';
    }

    const data = await SalaryAttendance.find(query);
    data.sort(compareBySurname);
    res.json(data);
  } catch (error) {
    console.error('Get salary attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user-specific salary data
router.get('/user/:userId', auth, async (req, res) => {
  try {
    console.log('Fetching salary data for userId:', req.params.userId);

    // Try to find salary attendance record by userId
    let data = await SalaryAttendance.findOne({ userId: req.params.userId });

    if (!data) {
      // If not found by userId, try to find by user's name
      const user = await User.findById(req.params.userId);
      if (user) {
        console.log('User found:', user.name);
        data = await SalaryAttendance.findOne({
          name: { $regex: new RegExp(user.name, 'i') }
        });
        console.log('Salary data found by name:', data ? 'Yes' : 'No');
      }
    }

    if (data) {
      console.log('Salary data found:', {
        name: data.name,
        exposed: data.exposed,
        monthYear: data.monthYear,
        adjustedSalary: data.adjustedSalary
      });

      // Check if user is admin or if data is exposed
      if (req.user.role !== 'Admin') {
        // For non-admin users, only return data if it's exposed
        if (!data.exposed) {
          console.log('Data not exposed to user, returning null');
          return res.json(null);
        }
      }
    } else {
      console.log('No salary data found for user');
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching user salary data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Expose salary data to user
router.put('/expose/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    let result;

    // Try to find by salary attendance record _id first
    result = await SalaryAttendance.findByIdAndUpdate(id, { exposed: true, updatedAt: new Date() });

    // If not found by _id, try by userId
    if (!result) {
      result = await SalaryAttendance.findOneAndUpdate(
        { userId: id },
        { exposed: true, updatedAt: new Date() }
      );
    }

    if (!result) {
      return res.status(404).json({ message: 'Salary record not found' });
    }

    console.log(`Exposed salary data for: ${result.name} (${result.userId})`);
    res.json({ message: 'Data exposed successfully', salaryData: result });
  } catch (error) {
    console.error('Expose salary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Adjust salary
router.put('/adjust/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { adjustedSalary, reason } = req.body;

    if (!adjustedSalary || adjustedSalary < 0) {
      return res.status(400).json({ message: 'Valid adjusted salary is required' });
    }

    const salaryRecord = await SalaryAttendance.findById(req.params.id);
    if (!salaryRecord) {
      return res.status(404).json({ message: 'Salary record not found' });
    }

    // Create salary adjustment record
    const adjustment = new SalaryAdjustment({
      attendanceId: salaryRecord._id,
      userId: salaryRecord.userId,
      originalSalary: salaryRecord.adjustedSalary,
      adjustedSalary: parseFloat(adjustedSalary),
      adjustmentReason: reason || 'Manual adjustment by admin',
      adjustedBy: req.user.id,
      monthYear: salaryRecord.monthYear
    });

    await adjustment.save();

    // Update salary record
    salaryRecord.adjustedSalary = parseFloat(adjustedSalary);
    salaryRecord.updatedAt = new Date();
    await salaryRecord.save();

    res.json({
      message: 'Salary adjusted successfully',
      salaryRecord,
      adjustment
    });
  } catch (error) {
    console.error('Salary adjustment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk expose to users
router.put('/expose-all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { monthYear, userIds } = req.body;
    let query = {};

    if (monthYear) {
      query.monthYear = monthYear;
    }

    if (userIds && userIds.length > 0) {
      query.userId = { $in: userIds };
    }

    const result = await SalaryAttendance.updateMany(query, {
      exposed: true,
      updatedAt: new Date()
    });

    res.json({
      message: `Exposed ${result.modifiedCount} salary records to users`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Bulk expose error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Download salary report
router.get('/download', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { monthYear, format = 'csv' } = req.query;
    let query = {};

    if (monthYear) {
      query.monthYear = monthYear;
    }

    const data = await SalaryAttendance.find(query);
    data.sort(compareBySurname);

    if (format === 'csv') {
      // Generate CSV file
      const fields = [
        'employeeId', 'name', 'dept', 'daysPresent', 'totalWorkingDays',
        'hoursWorked', 'salaryPercentage', 'baseSalary', 'calculatedSalary',
        'adjustedSalary', 'monthYear', 'exposed'
      ];
      const json2csv = new Parser({ fields });
      const csv = json2csv.parse(data);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=salary_report_${monthYear || 'all'}.csv`);
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Submit feedback
router.post('/feedback', auth, async (req, res) => {
  try {
    const { message, type, attendanceId } = req.body;

    const feedback = new Feedback({
      userId: req.user.id,
      message,
      type: type || 'general',
      attendanceId,
      monthYear: new Date().toISOString().slice(0, 7) // YYYY-MM format
    });

    await feedback.save();

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback: {
        _id: feedback._id,
        message: feedback.message,
        type: feedback.type,
        status: feedback.status,
        createdAt: feedback.createdAt
      }
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting feedback',
      error: error.message
    });
  }
});

// Get all feedbacks (admin) or user's own feedbacks
router.get('/feedback', auth, async (req, res) => {
  try {
    let query = {};

    // If not admin, only show user's own feedback
    if (req.user.role !== 'Admin') {
      query.userId = req.user.id;
    }

    const feedbacks = await Feedback.find(query)
      .populate('attendanceId', 'name monthYear')
      .sort({ createdAt: -1 });

    // Get user details for admin view
    if (req.user.role === 'Admin') {
      const userIds = [...new Set(feedbacks.map(f => f.userId))];
      const users = await User.find({ _id: { $in: userIds } }, 'name email');
      const userMap = users.reduce((acc, user) => {
        acc[user._id] = user;
        return acc;
      }, {});

      const enrichedFeedbacks = feedbacks.map(feedback => ({
        ...feedback.toObject(),
        user: userMap[feedback.userId] || { name: 'Unknown User', email: 'N/A' }
      }));

      res.json(enrichedFeedbacks);
    } else {
      res.json(feedbacks);
    }
  } catch (error) {
    console.error('Get feedbacks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching feedbacks',
      error: error.message
    });
  }
});

// Admin: Respond to feedback
router.put('/feedback/respond/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { adminResponse, status } = req.body;

    if (!adminResponse) {
      return res.status(400).json({ message: 'Admin response is required' });
    }

    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    feedback.adminResponse = adminResponse;
    feedback.status = status || 'reviewed';
    feedback.respondedBy = req.user.id;
    feedback.respondedAt = new Date();
    feedback.updatedAt = new Date();

    await feedback.save();

    res.json({
      success: true,
      message: 'Response added successfully',
      feedback
    });
  } catch (error) {
    console.error('Feedback response error:', error);
    res.status(500).json({
      success: false,
      message: 'Error responding to feedback',
      error: error.message
    });
  }
});

// Admin: Update feedback status
router.put('/feedback/status/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { status } = req.body;

    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    feedback.status = status;
    feedback.updatedAt = new Date();

    if (status === 'resolved') {
      feedback.respondedBy = req.user.id;
      feedback.respondedAt = new Date();
    }

    await feedback.save();

    res.json({
      success: true,
      message: 'Status updated successfully',
      feedback
    });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating status',
      error: error.message
    });
  }
});

module.exports = router;