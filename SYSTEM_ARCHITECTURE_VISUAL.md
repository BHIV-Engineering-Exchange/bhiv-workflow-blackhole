 # System Architecture - Real Data Flow Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EMPLOYEE DAILY WORKFLOW (Real-Time)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  Employee Clicks "Start Day" (9:00 AM)        │
           │  - Location: Office or Home                   │
           │  - GPS Coordinates captured                   │
           └───────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  POST /api/attendance/start-day               │
           │  ✅ Creates DailyAttendance record            │
           │  ✅ Sets startDayTime                         │
           │  ✅ Sets workLocationType (Office/Home)       │
           └───────────────────────────────────────────────┘
                                       │
                          ▼            │            ▼
                    [Works all day]   │      [MongoDB Saved]
                                      │
                                      ▼
           ┌───────────────────────────────────────────────┐
           │  Employee Clicks "End Day" (6:30 PM)          │
           │  - Adds completion notes                      │
           │  - GPS verified again                         │
           └───────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  POST /api/attendance/end-day                 │
           │  ✅ Updates DailyAttendance record            │
           │  ✅ Calculates totalHoursWorked               │
           │  ✅ Calculates overtimeHours                  │
           │  ✅ Allocates officeHours/remoteHours         │
           └───────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  DailyAttendance Record Created/Updated       │
           │                                               │
           │  {                                            │
           │    date: "2025-12-09",                        │
           │    startDayTime: "09:00",                     │
           │    endDayTime: "18:30",                       │
           │    totalHoursWorked: 9.5,  ← REAL DATA       │
           │    regularHours: 8.0,                         │
           │    overtimeHours: 1.5,                        │
           │    workLocationType: "Office",                │
           │    officeHours: 9.5,  ← Pending biometric     │
           │    remoteHours: 0,                            │
           │    source: "StartDay"                         │
           │  }                                            │
           └───────────────────────────────────────────────┘
                                       │
                                       │ [Repeats daily for entire month]
                                       │
                                       ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                   MONTHLY BIOMETRIC VERIFICATION (Transparency)              │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  Admin Prepares Biometric Excel (End Month)   │
           │                                               │
           │  ┌─────────────────────────────────────────┐ │
           │  │ Emp ID │ Date  │ Punch In │ Punch Out  │ │
           │  ├────────┼───────┼──────────┼────────────┤ │
           │  │ EMP001 │ 12/09 │ 08:55 AM │ 06:35 PM   │ │
           │  │ EMP001 │ 12/10 │ 09:05 AM │ 06:15 PM   │ │
           │  │ EMP002 │ 12/09 │ 09:10 AM │ 06:00 PM   │ │
           │  └─────────────────────────────────────────┘ │
           └───────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  POST /api/enhanced-salary/upload-biometric   │
           │  ✅ Parses Excel file                         │
           │  ✅ Matches with existing DailyAttendance     │
           │  ✅ Adds biometricTimeIn/Out                  │
           │  ✅ Verifies office presence                  │
           └───────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  DailyAttendance Record UPDATED               │
           │                                               │
           │  {                                            │
           │    // Original workflow data                  │
           │    startDayTime: "09:00",                     │
           │    endDayTime: "18:30",                       │
           │    totalHoursWorked: 9.5,                     │
           │                                               │
           │    // NEW: Biometric verification             │
           │    biometricTimeIn: "08:55",  ← PROOF         │
           │    biometricTimeOut: "18:35", ← PROOF         │
           │                                               │
           │    // UPDATED: Verified hours                 │
           │    officeHours: 9.67,  ← VERIFIED ✅          │
           │    remoteHours: 0,                            │
           │    workLocationType: "Office",  ← CONFIRMED   │
           │    verificationMethod: "Both",                │
           │                                               │
           │    // Discrepancy check                       │
           │    hasDiscrepancy: false  ← Times match       │
           │  }                                            │
           └───────────────────────────────────────────────┘
                                       │
                                       ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                    SALARY CALCULATION (Automatic)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  GET /api/hourly-salary/employee/USER/2025/12 │
           │                                               │
           │  System queries MongoDB:                      │
           │  - Find all DailyAttendance for Dec 2025      │
           │  - Sum totalHoursWorked from each day         │
           │  - Sum officeHours (biometric verified)       │
           │  - Sum remoteHours (WFH days)                 │
           │  - Sum overtimeHours                          │
           └───────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  Aggregation Pipeline (Real Data)             │
           │                                               │
           │  Day 1:  9.5h (9.5 office, 0 remote)         │
           │  Day 2:  8.0h (8.0 office, 0 remote)         │
           │  Day 3:  8.5h (0 office, 8.5 remote) ← WFH   │
           │  Day 4:  9.0h (9.0 office, 0 remote)         │
           │  ...                                          │
           │  Day 22: 8.0h (8.0 office, 0 remote)         │
           │                                               │
           │  ═══════════════════════════════════════      │
           │  Total Hours:     176h  ← REAL SUM           │
           │  Office Hours:    120h  ← BIOMETRIC VERIFIED │
           │  Remote Hours:     56h  ← WFH TRACKED        │
           │  Overtime Hours:    8h                        │
           └───────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  Salary Calculation Formula                   │
           │                                               │
           │  Hourly Rate: $25/hour (from User model)      │
           │                                               │
           │  Regular Hours: 168h (176 - 8 overtime)       │
           │  Regular Pay = 168 × $25 = $4,200            │
           │                                               │
           │  Overtime Hours: 8h                           │
           │  Overtime Pay = 8 × $25 × 1.5 = $300         │
           │                                               │
           │  Gross Salary = $4,200 + $300 = $4,500       │
           │                                               │
           │  + Allowances: $500                           │
           │  - Deductions: $200                           │
           │                                               │
           │  NET SALARY = $4,800  ← FINAL                │
           └───────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  Response with Complete Breakdown             │
           │                                               │
           │  {                                            │
           │    "employee": "John Doe",                    │
           │    "period": "December 2025",                 │
           │    "attendance": {                            │
           │      "presentDays": 22,                       │
           │      "attendanceRate": "70.97%"               │
           │    },                                         │
           │    "hours": {                                 │
           │      "totalHours": 176,    ← REAL            │
           │      "officeHours": 120,   ← VERIFIED        │
           │      "remoteHours": 56,    ← TRACKED         │
           │      "overtimeHours": 8                       │
           │    },                                         │
           │    "salary": {                                │
           │      "hourlyRate": 25,                        │
           │      "regularPay": 4200,                      │
           │      "overtimePay": 300,                      │
           │      "grossSalary": 4500,                     │
           │      "netSalary": 4800     ← FINAL           │
           │    },                                         │
           │    "attendanceDetails": [ ... 22 days ... ]   │
           │  }                                            │
           └───────────────────────────────────────────────┘
                                       │
                                       ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                      ADMIN DASHBOARD VIEW (All Employees)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  GET /api/hourly-salary/admin/dashboard       │
           │                                               │
           │  Aggregates data for ALL employees:           │
           │                                               │
           │  ┌─────────────────────────────────────────┐ │
           │  │ 👥 Total Employees: 20                  │ │
           │  │ ⏱️  Total Hours: 3,600h                 │ │
           │  │ 🏢 Office Hours: 2,400h (66.7%)         │ │
           │  │ 🏠 Remote Hours: 1,200h (33.3%)         │ │
           │  │ 💰 Total Payroll: $85,000               │ │
           │  └─────────────────────────────────────────┘ │
           │                                               │
           │  Employee Breakdown:                          │
           │  ┌──────────────────────────────────────┐    │
           │  │ John:   180h (120 office, 60 remote) │    │
           │  │ Jane:   170h (85 office, 85 remote)  │    │
           │  │ Mike:   175h (175 office, 0 remote)  │    │
           │  │ ...                                   │    │
           │  └──────────────────────────────────────┘    │
           └───────────────────────────────────────────────┘
                                       │
                                       ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                      ACTIVITY LOG (Daily Tracking)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
           ┌───────────────────────────────────────────────┐
           │  GET /api/hourly-salary/activity-log          │
           │                                               │
           │  Shows real-time worked hours for everyone:   │
           │                                               │
           │  ┌──────────────────────────────────────────┐│
           │  │ Date       │ Employee │ Hours │ Location ││
           │  ├────────────┼──────────┼───────┼──────────┤│
           │  │ 2025-12-09 │ John     │ 9.5h  │ Office ✅││
           │  │ 2025-12-09 │ Jane     │ 8.0h  │ Home 🏠 ││
           │  │ 2025-12-09 │ Mike     │ 9.0h  │ Office ✅││
           │  │ 2025-12-10 │ John     │ 8.0h  │ Office ✅││
           │  │ 2025-12-10 │ Jane     │ 8.5h  │ Home 🏠 ││
           │  │ ...                                       ││
           │  └──────────────────────────────────────────┘│
           └───────────────────────────────────────────────┘


╔═════════════════════════════════════════════════════════════════════════════╗
║                              DATA INTEGRITY                                  ║
╚═════════════════════════════════════════════════════════════════════════════╝

   ┌─────────────────┐
   │  Workflow Data  │  ← Employee's daily start/end times
   │  (Primary)      │     100% REAL, captured in real-time
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ DailyAttendance │  ← Stored in MongoDB
   │    Database     │     Permanent record with timestamps
   └────────┬────────┘
            │
            │  ┌─────────────────┐
            └──│ Biometric Data  │  ← Monthly verification
               │ (Verification)  │     Proves office presence
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │    Matching     │  ← System compares times
               │   & Merging     │     Detects discrepancies
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ Verified Record │  ← Final trusted data
               │   with Proof    │     Used for salary
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │  Salary Calc    │  ← Automatic calculation
               │    Engine       │     No manual intervention
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │  Payroll Ready  │  ← Ready for payment
               └─────────────────┘


╔═════════════════════════════════════════════════════════════════════════════╗
║                          KEY FEATURES SUMMARY                                ║
╚═════════════════════════════════════════════════════════════════════════════╝

   ✅ 100% Real Data     - No manual entry, from actual workflow
   ✅ Dual Verification  - Workflow + Biometric proof
   ✅ Auto Calculation   - Hours → Salary automatically
   ✅ Office vs Remote   - Clear separation and tracking
   ✅ Overtime Detection - Automatic (>8h/day = 1.5x rate)
   ✅ Transparency       - Employees see exact hours
   ✅ Discrepancy Alerts - Flags time mismatches
   ✅ Historical Records - All data archived
   ✅ Admin Dashboard    - Complete workforce overview
   ✅ Activity Log       - Real-time daily tracking

```
