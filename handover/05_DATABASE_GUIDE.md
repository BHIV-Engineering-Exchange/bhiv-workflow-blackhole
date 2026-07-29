# Database Guide — Niyantran (workflow-blackhole)

**Engine:** MongoDB (Mongoose ODM) · **Production target:** MongoDB Atlas, database `niyantran_database`-equivalent per `MONGODB_URI` (cluster `cluster0.7c16heb...` per the repo's real `.env` — connection string kept out of this document; see `11_CREDENTIALS_CONFIGURATION_REGISTER.md` for where it's stored) · **Local dev target:** the `mongo` container (`niyantran_database`) from `docker-compose.yml`, port 27017.

All schema information below was extracted directly from `server/models/*.js` with a script (not hand-transcribed), then spot-checked against the raw files. One false positive from the automated extraction was caught and corrected during review (`Project.js`'s registered model name — see note below).

## 1. All collections (43 model files)

| Model file | Collection (model name) | Field count | Relationships (`ref:`) |
|---|---|---|---|
| `Aim.js` | Aim | 15 | User, Department |
| `AIReview.js` | AIReview | 18 | Task, TaskSubmission, User |
| `Attendance.js` | Attendance | 53 | User, Leave |
| `AuditLog.js` | AuditLog | 5 | User |
| `BiometricPunch.js` | BiometricPunch | 13 | User, BiometricUpload, DailyAttendance |
| `BiometricUpload.js` | BiometricUpload | 29 | User |
| `Branch.js` | Branch | 10 | — |
| `ComplianceAuditLog.js` | ComplianceAuditLog | 16 | — |
| `Consent.js` | Consent | 8 | — |
| `DailyAttendance.js` | DailyAttendance | 60 | User, Leave |
| `Department.js` | Department | 7 | User |
| `EmailTemplate.js` | EmailTemplate | 8 | User |
| `EmployeeActivity.js` | EmployeeActivity | 10 | User |
| `EmployeeMaster.js` | EmployeeMaster | 22 | User, Department |
| `ExecutionEvent.js` | ExecutionEvent | 10 | — |
| `ExecutionLineage.js` | ExecutionLineage | 12 | — |
| `ExecutionRejection.js` | ExecutionRejection | 8 | — |
| `ExecutionSession.js` | ExecutionSession | 14 | — |
| `Feedback.js` | Feedback | 11 | SalaryAttendance |
| `Leave.js` | Leave | 19 | User |
| `LocationDiscrepancy.js` | LocationDiscrepancy | 15 | User, Attendance |
| `MonitoringAlert.js` | MonitoringAlert | 19 | User, ScreenCapture, Task |
| `NewSalaryRecord.js` | NewSalaryRecord | 23 | User |
| `Notification.js` | Notification | 7 | User, Task |
| `PaidLeaveConfig.js` | PaidLeaveConfig | 12 | User |
| `Progress.js` | Progress | 10 | Task, User |
| `Project.js` | **Project** *(corrected — see note below)* | 17 | Department, User, Task |
| `PublicHoliday.js` | PublicHoliday | 9 | Department, User |
| `PushSubscription.js` | PushSubscription | 5 | User |
| `Salary.js` | Salary | 19 | User |
| `SalaryAdjustment.js` | SalaryAdjustment | 9 | SalaryAttendance, Feedback |
| `SalaryAttendance.js` | SalaryAttendance | 29 | — |
| `ScheduledEmail.js` | ScheduledEmail | 10 | User |
| `ScreenCapture.js` | ScreenCapture | 15 | User, ScreenCapture (self-ref) |
| `Task.js` | Task | 15 | Department, User, Task (self-ref, for dependencies) |
| `TaskEvaluation.js` | TaskEvaluation | 24 | Task, TaskSubmission, User |
| `TaskSubmission.js` | TaskSubmission | 13 | Task, User |
| `Tenant.js` | *(none — file is empty, 0 bytes)* | 0 | — |
| `User.js` | User | 20 | Department |
| `UserTag.js` | UserTag | 17 | User, Department |
| `WebsiteWhitelist.js` | WebsiteWhitelist | 24 | Department, User |
| `WorkSession.js` | WorkSession | 17 | User |
| `WorkSessionUpdated.js` | *(duplicate — not used, see note below)* | 17 | User |

**Note on `Project.js`:** the file contains one line that *fetches* an already-registered model (`mongoose.model("Task")`, used internally to look up tasks belonging to a project) and a separate line that *registers* this file's own schema as `mongoose.model("Project", ProjectSchema)`. The automated extraction initially picked up the fetch line as if it were the registration — this was caught during review and corrected here. The real collection this file creates is **`Project`**, not `Task`.

## 2. Two most central schemas, field-by-field

**`User.js`** (20 fields): `name`, `email`, `password`, `role`, `department`, `avatar`, `googleId`, `profilePicture`, `stillExist`, `createdAt`, `updatedAt`, `monitoringPaused`, `lastConsentDate`, `dataRetentionPeriod`, `employeeId`, `hourlyRate`, `resetPasswordToken`, `resetPasswordExpires`, `workMode`, `branch`.

**`Task.js`** (15 fields): `title`, `description`, `status`, `priority`, `department`, `assignee`, `dueDate`, `dependencies`, `progress`, `createdAt`, `updatedAt`, `notes`, `fileType`, `links`, `branch`.

For the remaining 41 models, the field names are accurate (script-extracted) but not reproduced field-by-field here to keep this document readable — open the corresponding file in `server/models/` for the exact schema; the table above tells you which file to open and how many fields to expect, so you'll know immediately if you're looking at the right one.

## 3. Verified data-model issues

These are things found by literally diffing files and reading exports, not guesses:

1. **`WorkSession.js` and `WorkSessionUpdated.js` are byte-for-byte identical** (confirmed with `diff`, zero output). Both register the same Mongoose model name (`WorkSession`). Only `WorkSession.js` is actually imported anywhere in the codebase (4 call sites: `services/attendanceCronJobs.js`, `routes/attendance.js`, `routes/attendanceDataManagement.js`, `routes/monitoring.js`). `WorkSessionUpdated.js` is dead weight — safe to delete, but confirm with the team before removing in case it's a deliberate staging copy for an in-progress migration.
2. **`Tenant.js` is a completely empty file** (0 bytes) despite `middleware/tenantIsolation.js` existing and having its own passing test suite (`tenantIsolation.test.js`). This suggests tenant isolation logic exists at the middleware/query level but there is **no dedicated `Tenant` collection/model** — worth confirming with the team whether multi-tenancy is meant to be schema-less (tenant ID stored as a field on other documents) or whether this file is a placeholder for a model that was never finished.
3. **Duplicate index on `WebsiteWhitelist.approval_status`** — the field is declared with `index: true` *and* there's a separate `websiteWhitelistSchema.index({ approval_status: 1 })` call. Confirmed by reading both lines directly. Mongoose prints a startup warning about this every time the app boots (verified in `13_EVIDENCE_PACKET.md`). Harmless, but it's log noise and a one-line fix (remove either the field-level `index: true` or the explicit `.index()` call).

## 4. Relationships — how the graph connects

The most-referenced models (i.e. the ones most other collections point at via `ref:`) are, in order: **User** (referenced by ~30 of the other 42 models), **Task**, **Department**, and **Attendance/DailyAttendance**. This confirms the data model is fundamentally user-centric — nearly every feature (attendance, salary, tasks, monitoring, compliance) hangs off a `User` document. If you need to understand cascading-delete or data-retention implications of removing a user, start by grep-ing `ref: 'User'` across `models/`.

## 5. Migration history

No dedicated migrations framework (e.g. `migrate-mongo`) was found in `package.json` dependencies or as a folder. Schema evolution appears to happen by editing the Mongoose schema files directly and relying on MongoDB's schemaless nature to tolerate old documents missing new fields. `server/utils/attendanceDataMigration.js` is the one file that looks like a deliberate one-off data-migration script (for attendance data specifically) rather than a general migrations system — read it directly if you need to understand what shape change it performs.

## 6. Seed data

No dedicated seed script (e.g. `seed.js`, `fixtures/`) was found in `server/`. `server/scripts/` contains maintenance/one-off scripts — check there first if you need to bootstrap a fresh database with initial departments/admin users; none of these were confirmed as an official "seed the database" entrypoint, so treat any such script as unverified until you've read it.

## 7. Backup & restore procedures

Covered in full in `04_DEPLOYMENT_GUIDE.md` §7 — summary: a working, previously-executed `mongodump`/`mongorestore` script exists for the **local Docker Mongo container**, but it does not cover the **production Atlas cluster**; Atlas backup configuration needs separate confirmation from whoever administers that cluster.
