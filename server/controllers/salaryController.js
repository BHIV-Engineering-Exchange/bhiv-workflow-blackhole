const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs').promises;
const path = require('path');
const SalaryRecord = require('../models/SalaryRecord');
const Holiday = require('../models/Holiday');
const User = require('../models/User'); // Using User model as Employee
const { compareBySurname } = require('../utils/nameSorting');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/salary');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'biometric-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed!'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
}).single('file');

/**
 * Parse time string to hours
 * Supports formats: "HH:MM", "HH:MM:SS", "H:MM AM/PM"
 */
const parseTimeToHours = (timeString) => {
  if (!timeString || timeString === '' || timeString === '-') return null;
  
  try {
    const timeStr = timeString.toString().trim();
    
    // Handle AM/PM format
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      const isPM = timeStr.includes('PM');
      const timePart = timeStr.replace(/AM|PM/gi, '').trim();
      const [hours, minutes] = timePart.split(':').map(Number);
      let hour = hours;
      if (isPM && hours !== 12) hour += 12;
      if (!isPM && hours === 12) hour = 0;
      return hour + (minutes || 0) / 60;
    }
    
    // Handle 24-hour format
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    return hours + minutes / 60;
  } catch (error) {
    console.error('Error parsing time:', timeString, error);
    return null;
  }
};

/**
 * Calculate hours worked between punch in and punch out
 */
const calculateHoursWorked = (punchIn, punchOut) => {
  const inHours = parseTimeToHours(punchIn);
  const outHours = parseTimeToHours(punchOut);
  
  if (inHours === null || outHours === null) return 0;
  
  let diff = outHours - inHours;
  // Handle cases where punch out is next day
  if (diff < 0) diff += 24;
  
  return Math.round(diff * 100) / 100; // Round to 2 decimal places
};

/**
 * Parse Excel/CSV file and extract attendance data
 */
const parseAttendanceFile = async (filePath) => {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const data = xlsx.utils.sheet_to_json(worksheet, { 
      raw: false,
      defval: ''
    });
    
    return data;
  } catch (error) {
    throw new Error('Failed to parse file: ' + error.message);
  }
};

/**
 * Format date to YYYY-MM-DD
 */
const formatDate = (dateInput) => {
  if (!dateInput) return null;
  
  try {
    let date;
    
    // Handle Excel serial date numbers
    if (typeof dateInput === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      date = new Date(excelEpoch.getTime() + dateInput * 86400000);
    } else {
      date = new Date(dateInput);
    }
    
    if (isNaN(date.getTime())) return null;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date:', dateInput, error);
    return null;
  }
};

/**
 * Process attendance data and calculate salaries
 */
const processAttendanceData = async (data, holidays) => {
  const employeeMap = new Map();
  const holidaySet = new Set(holidays.map(h => h.date));
  
  // Group data by employee
  for (const row of data) {
    // Support multiple column name variations
    const employeeId = row['Employee ID'] || row['EmployeeID'] || row['empId'] || row['ID'] || '';
    const name = row['Name'] || row['EmployeeName'] || row['Employee Name'] || '';
    const dateStr = formatDate(row['Date'] || row['date'] || row['Attendance Date']);
    const punchIn = row['Punch In'] || row['PunchIn'] || row['In Time'] || row['Check In'] || '';
    const punchOut = row['Punch Out'] || row['PunchOut'] || row['Out Time'] || row['Check Out'] || '';
    
    if (!employeeId || !dateStr) continue;
    
    const isHoliday = holidaySet.has(dateStr);
    const hoursWorked = isHoliday ? 0 : calculateHoursWorked(punchIn, punchOut);
    
    if (!employeeMap.has(employeeId)) {
      employeeMap.set(employeeId, {
        employeeId,
        name,
        totalHours: 0,
        dailyRecords: [],
        holidaysExcluded: []
      });
    }
    
    const employee = employeeMap.get(employeeId);
    employee.totalHours += hoursWorked;
    
    employee.dailyRecords.push({
      date: dateStr,
      punchIn,
      punchOut,
      hoursWorked,
      isHoliday
    });
    
    if (isHoliday) {
      employee.holidaysExcluded.push(dateStr);
    }
  }
  
  return Array.from(employeeMap.values());
};

/**
 * Upload and process biometric attendance file
 * POST /api/salary/upload
 */
exports.uploadAndCalculate = async (req, res) => {
  upload(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ 
        success: false, 
        message: 'File upload error: ' + err.message 
      });
    } else if (err) {
      return res.status(400).json({ 
        success: false, 
        message: err.message 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please upload a file' 
      });
    }
    
    const filePath = req.file.path;
    
    try {
      // Parse the uploaded file
      const attendanceData = await parseAttendanceFile(filePath);
      
      if (!attendanceData || attendanceData.length === 0) {
        throw new Error('No data found in the uploaded file');
      }
      
      // Extract month from the data (use first record's date)
      const firstDate = formatDate(
        attendanceData[0]['Date'] || 
        attendanceData[0]['date'] || 
        attendanceData[0]['Attendance Date']
      );
      
      if (!firstDate) {
        throw new Error('Cannot determine month from attendance data');
      }
      
      const month = firstDate.substring(0, 7); // YYYY-MM
      
      // Get holidays for this month
      const holidays = await Holiday.getHolidaysForMonth(month);
      
      // Process attendance data
      const processedData = await processAttendanceData(attendanceData, holidays);
      
      // Fetch employee hourly rates from database
      const employeeIds = processedData.map(e => e.employeeId);
      const users = await User.find({ 
        employeeId: { $in: employeeIds } 
      }).select('employeeId hourlyRate name');
      
      // Create a map of employeeId to hourlyRate
      const employeeRateMap = new Map(
        users.map(u => [u.employeeId, u.hourlyRate || 25])
      );
      
      // Set default rate for employees not found in database
      const DEFAULT_HOURLY_RATE = 25; // $25/hour default
      processedData.forEach(e => {
        if (!employeeRateMap.has(e.employeeId)) {
          employeeRateMap.set(e.employeeId, DEFAULT_HOURLY_RATE);
        }
      });
      
      // Calculate salaries and save records
      const salaryRecords = [];
      
      for (const empData of processedData) {
        const hourlyRate = employeeRateMap.get(empData.employeeId) || 0;
        const totalSalary = Math.round(empData.totalHours * hourlyRate * 100) / 100;
        
        // Check if record already exists for this employee and month
        let salaryRecord = await SalaryRecord.findOne({
          employeeId: empData.employeeId,
          month
        });
        
        if (salaryRecord) {
          // Update existing record
          salaryRecord.name = empData.name;
          salaryRecord.totalHours = empData.totalHours;
          salaryRecord.hourlyRate = hourlyRate;
          salaryRecord.totalSalary = totalSalary;
          salaryRecord.holidaysExcluded = empData.holidaysExcluded;
          salaryRecord.dailyRecords = empData.dailyRecords;
          salaryRecord.uploadDate = new Date();
        } else {
          // Create new record
          salaryRecord = new SalaryRecord({
            employeeId: empData.employeeId,
            name: empData.name,
            month,
            totalHours: empData.totalHours,
            hourlyRate,
            totalSalary,
            holidaysExcluded: empData.holidaysExcluded,
            dailyRecords: empData.dailyRecords
          });
        }
        
        await salaryRecord.save();
        salaryRecords.push(salaryRecord);
      }
      
      // Delete the uploaded file after processing
      await fs.unlink(filePath);
      
      res.status(200).json({
        success: true,
        message: `Successfully processed ${salaryRecords.length} salary records for ${month}`,
        data: {
          month,
          recordsProcessed: salaryRecords.length,
          holidaysExcluded: holidays.length,
          salaryRecords
        }
      });
      
    } catch (error) {
      console.error('Error processing salary file:', error);
      
      // Clean up file on error
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
      
      res.status(500).json({
        success: false,
        message: 'Error processing file: ' + error.message
      });
    }
  });
};

/**
 * Get salary records for a specific month
 * GET /api/salary/:month
 */
exports.getSalaryByMonth = async (req, res) => {
  try {
    const { month } = req.params; // Format: YYYY-MM
    
    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month format. Use YYYY-MM'
      });
    }
    
    const salaryRecords = await SalaryRecord.find({ month });
    salaryRecords.sort(compareBySurname);
    
    const holidays = await Holiday.getHolidaysForMonth(month);
    
    res.status(200).json({
      success: true,
      data: {
        month,
        totalRecords: salaryRecords.length,
        totalSalary: salaryRecords.reduce((sum, r) => sum + r.totalSalary, 0),
        holidays: holidays.length,
        records: salaryRecords
      }
    });
    
  } catch (error) {
    console.error('Error fetching salary records:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary records: ' + error.message
    });
  }
};

/**
 * Update hourly rate for a salary record
 * PUT /api/salary/:id/rate
 */
exports.updateHourlyRate = async (req, res) => {
  try {
    const { id } = req.params;
    const { hourlyRate } = req.body;
    
    if (!hourlyRate || hourlyRate < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid hourly rate is required'
      });
    }
    
    const salaryRecord = await SalaryRecord.findById(id);
    
    if (!salaryRecord) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found'
      });
    }
    
    salaryRecord.hourlyRate = hourlyRate;
    salaryRecord.totalSalary = Math.round(salaryRecord.totalHours * hourlyRate * 100) / 100;
    
    await salaryRecord.save();
    
    res.status(200).json({
      success: true,
      message: 'Hourly rate updated successfully',
      data: salaryRecord
    });
    
  } catch (error) {
    console.error('Error updating hourly rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating hourly rate: ' + error.message
    });
  }
};

/**
 * Add or update holidays
 * POST /api/salary/holidays
 */
exports.manageHolidays = async (req, res) => {
  try {
    const { date, description, type, isRecurring } = req.body;
    
    if (!date || !description) {
      return res.status(400).json({
        success: false,
        message: 'Date and description are required'
      });
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    // Check if holiday already exists
    let holiday = await Holiday.findOne({ date });
    
    if (holiday) {
      // Update existing holiday
      holiday.description = description;
      if (type) holiday.type = type;
      if (isRecurring !== undefined) holiday.isRecurring = isRecurring;
    } else {
      // Create new holiday
      holiday = new Holiday({
        date,
        description,
        type: type || 'public',
        isRecurring: isRecurring || false,
        createdBy: req.user?._id
      });
    }
    
    await holiday.save();
    
    res.status(200).json({
      success: true,
      message: holiday.isNew ? 'Holiday added successfully' : 'Holiday updated successfully',
      data: holiday
    });
    
  } catch (error) {
    console.error('Error managing holiday:', error);
    res.status(500).json({
      success: false,
      message: 'Error managing holiday: ' + error.message
    });
  }
};

/**
 * Get all holidays
 * GET /api/salary/holidays
 */
exports.getAllHolidays = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    let query = {};
    
    if (month && year) {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const startDate = `${monthStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${monthStr}-${lastDay}`;
      
      query.date = { $gte: startDate, $lte: endDate };
    } else if (year) {
      query.date = { $gte: `${year}-01-01`, $lte: `${year}-12-31` };
    }
    
    const holidays = await Holiday.find(query).sort({ date: 1 });
    
    res.status(200).json({
      success: true,
      data: holidays
    });
    
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching holidays: ' + error.message
    });
  }
};

/**
 * Delete a holiday
 * DELETE /api/salary/holidays/:id
 */
exports.deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    
    const holiday = await Holiday.findByIdAndDelete(id);
    
    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Holiday deleted successfully',
      data: holiday
    });
    
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting holiday: ' + error.message
    });
  }
};

/**
 * Delete a salary record
 * DELETE /api/salary/:id
 */
exports.deleteSalaryRecord = async (req, res) => {
  try {
    const { id } = req.params;
    
    const record = await SalaryRecord.findByIdAndDelete(id);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Salary record deleted successfully',
      data: record
    });
    
  } catch (error) {
    console.error('Error deleting salary record:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting salary record: ' + error.message
    });
  }
};

/**
 * Get salary statistics
 * GET /api/salary/stats/:month
 */
exports.getSalaryStats = async (req, res) => {
  try {
    const { month } = req.params;
    
    const records = await SalaryRecord.find({ month });
    
    const stats = {
      totalEmployees: records.length,
      totalHours: records.reduce((sum, r) => sum + r.totalHours, 0),
      totalSalary: records.reduce((sum, r) => sum + r.totalSalary, 0),
      averageHours: 0,
      averageSalary: 0,
      statusBreakdown: {
        pending: 0,
        approved: 0,
        paid: 0
      }
    };
    
    if (records.length > 0) {
      stats.averageHours = stats.totalHours / records.length;
      stats.averageSalary = stats.totalSalary / records.length;
    }
    
    records.forEach(r => {
      stats.statusBreakdown[r.status]++;
    });
    
    res.status(200).json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error fetching salary stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary stats: ' + error.message
    });
  }
};
