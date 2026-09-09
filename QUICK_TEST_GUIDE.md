  # Quick Test Guide - Salary System with Real Data

## Prerequisites
- Server running on `http://localhost:5000`
- Valid auth token from login
- At least one user account

## Step-by-Step Testing

### Step 1: Login and Get Token
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "yourpassword"
  }'

# Save the token from response
TOKEN="your_token_here"
USER_ID="your_user_id_here"
```

### Step 2: Start Day (Morning Workflow)
```bash
# Employee starts work at office
curl -X POST http://localhost:5000/api/attendance/start-day/$USER_ID \
  -H "x-auth-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 19.158900,
    "longitude": 72.838645,
    "address": "Office Location",
    "accuracy": 10,
    "workFromHome": false
  }'

# Response shows:
# ✅ Day started successfully
# ✅ DailyAttendance record created
# ✅ startDayTime recorded
```

### Step 3: End Day (Evening Workflow)
```bash
# Employee ends work after 9 hours
curl -X POST http://localhost:5000/api/attendance/end-day/$USER_ID \
  -H "x-auth-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 19.158900,
    "longitude": 72.838645,
    "notes": "Completed all tasks"
  }'

# Response shows:
# ✅ Day ended successfully! You worked 9.5 hours today
# ✅ totalHoursWorked calculated
# ✅ overtimeHours calculated (1.5h)
```

### Step 4: Check My Salary (Real-Time)
```bash
# View current month salary with real hours
curl -X GET http://localhost:5000/api/hourly-salary/my-salary/current \
  -H "x-auth-token: $TOKEN"

# Response shows real data:
{
  "hours": {
    "totalHours": 9.5,        // From today's start/end
    "officeHours": 9.5,       // From office location
    "remoteHours": 0,
    "overtimeHours": 1.5
  },
  "salary": {
    "regularPay": 200,        // 8h × $25
    "overtimePay": 56.25,     // 1.5h × $25 × 1.5
    "grossSalary": 256.25
  }
}
```

### Step 5: Upload Biometric (Monthly - Admin Only)
```bash
# Admin uploads biometric Excel at end of month
curl -X POST http://localhost:5000/api/enhanced-salary/upload-biometric \
  -H "x-auth-token: $ADMIN_TOKEN" \
  -F "file=@biometric_december.xlsx"

# The Excel should have:
# Employee ID | Name | Date | Punch In | Punch Out
# EMP001 | John | 2025-12-09 | 08:55 AM | 06:35 PM

# Response shows:
# ✅ Processed 22 records
# ✅ Biometric data matched with workflow data
# ✅ Office hours verified
```

### Step 6: View Activity Log (Admin/Manager)
```bash
# See all employees' real worked hours
curl -X GET "http://localhost:5000/api/hourly-salary/activity-log?year=2025&month=12" \
  -H "x-auth-token: $TOKEN"

# Response shows:
{
  "summary": {
    "totalHours": 3600,          // Real sum from all employees
    "totalOfficeHours": 2400,    // Verified by biometric
    "totalRemoteHours": 1200     // From WFH tracking
  },
  "activityLog": [
    {
      "userName": "John Doe",
      "date": "2025-12-09",
      "totalHoursWorked": 9.5,   // Real from workflow
      "officeHours": 9.5,        // Verified by biometric
      "workLocationType": "Office"
    }
  ]
}
```

### Step 7: Admin Dashboard (Complete View)
```bash
# Admin views complete workforce data
curl -X GET http://localhost:5000/api/hourly-salary/admin/dashboard/2025/12 \
  -H "x-auth-token: $ADMIN_TOKEN"

# Response shows:
{
  "overallStats": {
    "totalEmployees": 20,
    "totalHoursWorked": 3600,      // Real aggregated hours
    "totalOfficeHours": 2400,      // Biometric verified
    "totalRemoteHours": 1200,      // WFH tracked
    "totalGrossSalary": 90000      // Based on real hours
  },
  "employees": [...]
}
```

### Step 8: Calculate Specific Employee (Detailed)
```bash
# Get detailed salary for any employee
curl -X GET http://localhost:5000/api/hourly-salary/employee/$USER_ID/calculate/2025/12 \
  -H "x-auth-token: $TOKEN"

# Response includes:
# ✅ Complete attendance details for all 31 days
# ✅ Day-by-day hours breakdown
# ✅ Office vs Remote hours
# ✅ Complete salary calculation
```

## Test Scenarios

### Scenario A: Office Employee (Full Month)
```bash
# Day 1-22: Work from office (use start/end day)
for day in {1..22}; do
  # Start at 9 AM
  curl -X POST http://localhost:5000/api/attendance/start-day/$USER_ID \
    -H "x-auth-token: $TOKEN" \
    -d '{"latitude": 19.158900, "longitude": 72.838645, "workFromHome": false}'
  
  # End at 6 PM (9 hours)
  sleep 32400  # Wait 9 hours in real scenario
  curl -X POST http://localhost:5000/api/attendance/end-day/$USER_ID \
    -H "x-auth-token: $TOKEN"
done

# End of month: Admin uploads biometric
# Result: 
# - 22 days × 9 hours = 198 hours
# - All verified as office hours
# - Salary = 198h × $25 = $4,950
```

### Scenario B: Hybrid Employee (Mix Office + WFH)
```bash
# Days 1-15: Office
curl -X POST http://localhost:5000/api/attendance/start-day/$USER_ID \
  -d '{"workFromHome": false, ...}'

# Days 16-22: Work from home
curl -X POST http://localhost:5000/api/attendance/start-day/$USER_ID \
  -d '{"workFromHome": true, ...}'

# Result after biometric upload:
# - Days 1-15: officeHours = 135h (verified)
# - Days 16-22: remoteHours = 63h (no biometric)
# - Total = 198h, Split shown clearly
```

### Scenario C: Overtime Worker
```bash
# Employee works 10 hours per day
# Start at 9 AM, End at 7 PM

# Day calculation:
# Regular: 8h × $25 = $200
# Overtime: 2h × $25 × 1.5 = $75
# Daily total = $275

# Monthly (22 days):
# Regular: 176h × $25 = $4,400
# Overtime: 44h × $25 × 1.5 = $1,650
# Total = $6,050
```

## Verification Checklist

After running tests, verify:

- [ ] DailyAttendance records created for each day
- [ ] Hours calculated correctly (end - start)
- [ ] Overtime detected for hours > 8
- [ ] Work location set based on WFH flag
- [ ] Biometric data merged with workflow data
- [ ] Office hours updated after biometric upload
- [ ] Salary calculated using real hours
- [ ] Activity log shows all employees
- [ ] Admin dashboard aggregates correctly

## Database Verification

Check MongoDB directly:
```javascript
// In MongoDB shell
use your_database

// Check daily attendance
db.dailyattendances.find({
  user: ObjectId("USER_ID"),
  date: { $gte: ISODate("2025-12-01") }
}).pretty()

// Should show:
{
  startDayTime: ISODate("2025-12-09T09:00:00Z"),
  endDayTime: ISODate("2025-12-09T18:00:00Z"),
  totalHoursWorked: 9,
  officeHours: 9,
  remoteHours: 0,
  workLocationType: "Office",
  biometricTimeIn: ISODate("2025-12-09T08:55:00Z"),  // After upload
  biometricTimeOut: ISODate("2025-12-09T18:05:00Z")
}

// Check salary records
db.salaryattendances.find({
  userId: "USER_ID",
  monthYear: "2025-12"
}).pretty()
```

## Common Issues & Solutions

### Issue: Hours showing as 0
**Solution:** Make sure both start-day AND end-day are called

### Issue: All hours showing as remote
**Solution:** Ensure biometric Excel is uploaded by admin

### Issue: Salary not calculating
**Solution:** Check if hourlyRate is set in User model

### Issue: Discrepancy detected
**Solution:** Normal! Shows workflow vs biometric time difference

## Next Steps

1. ✅ Test with real user accounts
2. ✅ Upload actual biometric data
3. ✅ Verify calculations match expected
4. ✅ Test with multiple employees
5. ✅ Generate monthly reports
6. ✅ Export to Excel/PDF

## Production Deployment

Before going live:
1. Set proper hourly rates for all employees
2. Test with previous month's real data
3. Train admins on biometric upload
4. Set up automated reports
5. Configure email notifications

---

**All APIs are working and using REAL DATA from workflow tracking!** 🎉
