# API Documentation — Niyantran (workflow-blackhole)

**Base URL (dev):** `http://localhost:5000/api` (or `HOST_BACKEND_PORT`) · **Base URL (prod):** production domain, TLS terminated in front of nginx (see `04_DEPLOYMENT_GUIDE.md` §4)

**Total verified live endpoints: 311**, across 38 mount points, extracted directly from `server/index.js` and the 38 route files it actually loads (script-generated inventory, cross-checked against the file contents — not hand-typed, and commented-out/dead route definitions were explicitly excluded). The full endpoint-by-endpoint reference table is in §5.

## 1. Authentication — how every protected route actually works

- Header: **`x-auth-token: <jwt>`** (confirmed in `client/src/lib/api.js` — this is **not** an `Authorization: Bearer` header, despite that being the more common convention; don't assume it without checking, and don't "fix" it to Bearer without updating both client and server together).
- Token issued by `POST /api/auth/login` or `POST /api/auth/register`, signed with `JWT_SECRET`, expiry `180d`.
- Verified by `middleware/auth.js`, which populates `req.user` from the decoded payload (`id`, `name`, `email`, `role`, `department`, `branch`).
- Admin/Manager-only routes additionally pass through `middleware/adminAuth.js`, which checks `req.user.role`.

### ⚠ Critical: passwords are not hashed

Read directly from `routes/auth.js`: registration stores `req.body.password` as-is on the `User` document, and login/verify-password compare it with strict equality (`password !== user.password`) — no `bcrypt.hash`/`bcrypt.compare` call anywhere in the active code path, and `models/User.js` has no password-hashing pre-save hook. `bcryptjs` is an installed dependency but is not actually invoked for this; `routes/admin.js` even has a comment confirming this was deliberate (`// Handle password update (without bcrypt)`). **Every password in the database is plaintext and every login is a plaintext string comparison.** This is documented in full in `07_KNOWN_ISSUES_REGISTER.md` item #1 — treat it as the top-priority item in this whole handover, not a routine code-quality note.

### `POST /api/auth/register`

Request body:
```json
{ "name": "string", "email": "string", "password": "string", "role": "Admin|Manager|User|Tester", "department": "ObjectId (optional)", "branch": "string (optional, defaults to blackhole_mumbai)" }
```
- `email` must pass `isValidOrgEmail()` (org-domain check) or the request is rejected with `400`.
- `role` must be one of the 4 listed values or `400`.
- On success: `201` with `{ token, user: {id, name, email, role, department, branch} }`.
- Failure scenarios (verified from code): `400` if email fails the org-domain check; `400` if a user with that email already exists; `400` if role is invalid or department ID isn't a valid ObjectId; `500` on any unhandled error (caught and logged server-side, generic `{error:"Server error"}` returned to the client).

### `POST /api/auth/login`

Request: `{ "email": "string", "password": "string" }` → `200` with `{ token, user: {...} }`, or `400 {"error":"Invalid credentials"}` if the email isn't found or the password doesn't match (deliberately the same error message for both cases, which is good practice — it doesn't reveal whether the email exists).

### `GET /api/auth/me` (protected)

Returns the current user document with `.select("-password")` (password field excluded from the response — good practice on the read side, even though the write side has no hashing).

### `POST /api/auth/forgot-password`, `GET /api/auth/verify-reset-token/:token`, `POST /api/auth/reset-password/:token`

Standard reset flow, email-based. Not deep-dived here — read `routes/auth.js` lines 576+ directly if you're modifying this flow; the logic is self-contained and doesn't call out to anything not already documented elsewhere in this package.

## 2. A second fully-documented example: Tasks

### `GET /api/tasks` (protected)

Returns tasks, typically filtered by the requesting user's department/assignment depending on role — read `routes/tasks.js` for the exact query logic if you're changing visibility rules, since it branches on `req.user.role`.

### `POST /api/tasks` (protected, Admin/Manager)

Request body maps directly to the `Task` schema fields documented in `05_DATABASE_GUIDE.md`: `title`, `description`, `department`, `assignee`, `priority`, `status`, `dependencies`, `dueDate`, `notes`, `fileType`, `links`, `branch`. `createdBy`/`createdAt`/`updatedAt` are server-set, not client-supplied.

For the remaining 300+ endpoints, this document does not fabricate exact request/response JSON shapes it hasn't verified — instead, §5 gives you the verified method + full path for every one of them, grouped by the route file that implements it, so you know exactly which file to open for the authoritative request/response contract. This is a deliberate choice: guessing field names for endpoints we haven't read in full would be less useful (and less honest) than pointing you at the real source.

## 3. Common failure-scenario conventions (verified pattern, consistent across route files)

| Status | Meaning | Typical body |
|---|---|---|
| `400` | Validation error / bad input | `{ "error": "<message>" }` |
| `401` | Missing/invalid JWT | `{ "error": "..." }` — set by `middleware/auth.js` |
| `403` | Authenticated but insufficient role | `{ "error": "Access denied. Admin or Manager only." }` (from `adminAuth.js`) |
| `404` | Resource not found | `{ "error": "<resource> not found" }` |
| `500` | Unhandled server error | `{ "error": "Server error" }` — the real error is `console.error`'d server-side, never leaked to the client |

## 4. Dependencies per endpoint group (what breaks if X is down)

| If this is unavailable | These endpoint groups degrade or fail |
|---|---|
| MongoDB Atlas | Everything — every route ultimately reads/writes Mongoose models |
| Redis | Nothing fails — `eventBus.js` falls back to in-process events automatically (verified in code) |
| Cloudinary | `/api/ems*`, `/api/biometric*`, any screenshot/file-upload endpoints |
| Groq / Gemini | `/api/ai*`, `/api/new/ai*` — AI review/optimization features specifically |
| SMTP | `/api/auth/forgot-password`, welcome emails on register, leave/procurement notification emails |
| TANTRA gateway / SETU (Sampada) | `/api/tantra*`, `/api/integration*` — these will report degraded health but shouldn't crash the rest of the app |

## 5. Full verified endpoint reference (311 endpoints, grouped by route file)

Expand any section below for the complete method + path list for that module. Generated directly from the mounted route files in `server/index.js` — this is the authoritative, current API surface.

<details><summary><b>admin.js</b> — 17 endpoints (mounted at /api/admin)</summary>

| Method | Path |
|---|---|
| GET | `/api/admin/users` |
| GET | `/api/admin/users/all` |
| GET | `/api/admin/users/:id` |
| POST | `/api/admin/users` |
| PUT | `/api/admin/users/:id` |
| PUT | `/api/admin/users/:id/status` |
| DELETE | `/api/admin/users/:id` |
| GET | `/api/admin/users/role/:role` |
| GET | `/api/admin/users/search` |
| GET | `/api/admin/departments` |
| GET | `/api/admin/departments/:id` |
| POST | `/api/admin/departments` |
| PUT | `/api/admin/departments/:id` |
| DELETE | `/api/admin/departments/:id` |
| PUT | `/api/admin/departments/:id/members` |
| DELETE | `/api/admin/departments/:id/members/:userId` |
| GET | `/api/admin/departments/:id/tasks` |

</details>

<details><summary><b>agentActivity.js</b> — 2 endpoints (mounted at /api/agent)</summary>

| Method | Path |
|---|---|
| POST | `/api/agent/activity/ingest` |
| GET | `/api/agent/activity/summary/:userId` |

</details>

<details><summary><b>ai.js</b> — 3 endpoints (mounted at /api/ai)</summary>

| Method | Path |
|---|---|
| GET | `/api/ai/insights` |
| POST | `/api/ai/optimize` |
| GET | `/api/ai/dependencies` |

</details>

<details><summary><b>aiRoutes.js</b> — 2 endpoints (mounted at /api/new/ai)</summary>

| Method | Path |
|---|---|
| GET | `/api/new/ai/insights` |
| POST | `/api/new/ai/optimize` |

</details>

<details><summary><b>aims_universal.js</b> — 14 endpoints (mounted at /api/aims)</summary>

| Method | Path |
|---|---|
| GET | `/api/aims` |
| GET | `/api/aims/today/:id` |
| GET | `/api/aims/user/:userId` |
| GET | `/api/aims/all` |
| GET | `/api/aims/with-progress` |
| GET | `/api/aims/all-with-progress` |
| GET | `/api/aims/user/:userId/with-progress` |
| POST | `/api/aims/postaim/:id` |
| PUT | `/api/aims/:id` |
| DELETE | `/api/aims/:id` |
| POST | `/api/aims/sync-progress-to-aim` |
| POST | `/api/aims/sync-attendance-to-aim` |
| GET | `/api/aims/debug` |
| DELETE | `/api/aims/cleanup-default` |

</details>

<details><summary><b>alerts.js</b> — 1 endpoints (mounted at /api/alerts)</summary>

| Method | Path |
|---|---|
| GET | `/api/alerts` |

</details>

<details><summary><b>attendance.js</b> — 12 endpoints (mounted at /api/attendance)</summary>

| Method | Path |
|---|---|
| POST | `/api/attendance/start` |
| POST | `/api/attendance/start-day/:userId` |
| POST | `/api/attendance/end-day/:userId` |
| POST | `/api/attendance/auto-end-day-midnight` |
| POST | `/api/attendance/validate-spam-hours/:recordId` |
| POST | `/api/attendance/auto-end-day` |
| GET | `/api/attendance/analytics` |
| GET | `/api/attendance/user/:userId` |
| GET | `/api/attendance/verify/:userId` |
| GET | `/api/attendance/live` |
| POST | `/api/attendance/upload` |
| POST | `/api/attendance/confirm-upload` |

</details>

<details><summary><b>attendanceDashboard.js</b> — 12 endpoints (mounted at /api/attendance-dashboard)</summary>

| Method | Path |
|---|---|
| GET | `/api/attendance-dashboard/locations` |
| GET | `/api/attendance-dashboard/start-time-summary` |
| GET | `/api/attendance-dashboard/attendance-tracking` |
| GET | `/api/attendance-dashboard/departments` |
| GET | `/api/attendance-dashboard/dashboard-data` |
| GET | `/api/attendance-dashboard/export/start-times` |
| GET | `/api/attendance-dashboard/user-average` |
| GET | `/api/attendance-dashboard/employee-history/:userId` |
| POST | `/api/attendance-dashboard/admin/sync-attendance` |
| GET | `/api/attendance-dashboard/admin/sync-status` |
| GET | `/api/attendance-dashboard/admin/check-date-data` |
| POST | `/api/attendance-dashboard/admin/sync-and-fetch` |

</details>

<details><summary><b>attendanceStatus.js</b> — 1 endpoints (mounted at /api/attendance)</summary>

| Method | Path |
|---|---|
| GET | `/api/attendance/status` |

</details>

<details><summary><b>auth.js</b> — 7 endpoints (mounted at /api/auth)</summary>

| Method | Path |
|---|---|
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| POST | `/api/auth/verify-password` |
| GET | `/api/auth/me` |
| POST | `/api/auth/forgot-password` |
| GET | `/api/auth/verify-reset-token/:token` |
| POST | `/api/auth/reset-password/:token` |

</details>

<details><summary><b>biometricAttendance.js</b> — 23 endpoints (mounted at /api/biometric)</summary>

| Method | Path |
|---|---|
| POST | `/api/biometric/upload` |
| POST | `/api/biometric/derive-attendance` |
| POST | `/api/biometric/salary-calculation` |
| GET | `/api/biometric/dashboard-kpis` |
| GET | `/api/biometric/detailed-logs` |
| GET | `/api/biometric/employee-aggregates` |
| POST | `/api/biometric/employee-master` |
| GET | `/api/biometric/employee-master` |
| GET | `/api/biometric/upload-history` |
| GET | `/api/biometric/export-salary` |
| GET | `/api/biometric/export-detailed-logs` |
| GET | `/api/biometric/departments` |
| GET | `/api/biometric/users` |
| GET | `/api/biometric/public-holidays` |
| POST | `/api/biometric/public-holidays` |
| PUT | `/api/biometric/public-holidays/:id` |
| DELETE | `/api/biometric/public-holidays/:id` |
| GET | `/api/biometric/paid-leaves` |
| POST | `/api/biometric/paid-leaves` |
| PUT | `/api/biometric/paid-leaves/:id` |
| DELETE | `/api/biometric/paid-leaves/:id` |
| PUT | `/api/biometric/employee-hourly-rate/:userId` |
| GET | `/api/biometric/employee-hourly-rates` |

</details>

<details><summary><b>branchRoutes.js</b> — 9 endpoints (mounted at /api/branches)</summary>

| Method | Path |
|---|---|
| GET | `/api/branches` |
| GET | `/api/branches/all` |
| GET | `/api/branches/:id` |
| POST | `/api/branches` |
| PUT | `/api/branches/:id` |
| DELETE | `/api/branches/:id` |
| POST | `/api/branches/:id/set-password` |
| POST | `/api/branches/verify-switch-password` |
| GET | `/api/branches/:id/has-password` |

</details>

<details><summary><b>chatbot.js</b> — 3 endpoints (mounted at /api/chatbot)</summary>

| Method | Path |
|---|---|
| POST | `/api/chatbot/chat` |
| POST | `/api/chatbot/clear` |
| GET | `/api/chatbot/status` |

</details>

<details><summary><b>consent.js</b> — 1 endpoints (mounted at /api/consent)</summary>

| Method | Path |
|---|---|
| POST | `/api/consent` |

</details>

<details><summary><b>dashboard.js</b> — 8 endpoints (mounted at /api/dashboard)</summary>

| Method | Path |
|---|---|
| GET | `/api/dashboard/leaderboard` |
| GET | `/api/dashboard/stats` |
| GET | `/api/dashboard/departments` |
| GET | `/api/dashboard/tasks-overview` |
| GET | `/api/dashboard/activity` |
| GET | `/api/dashboard/user-stats/:userId` |
| GET | `/api/dashboard/progress-stats` |
| GET | `/api/dashboard/admin-report` |

</details>

<details><summary><b>dashboardFixed.js</b> — 4 endpoints (mounted at /api/dashboard)</summary>

| Method | Path |
|---|---|
| GET | `/api/dashboard/attendance-summary` |
| GET | `/api/dashboard/merge-analysis` |
| GET | `/api/dashboard/employee/:userId/monthly` |
| GET | `/api/dashboard/mismatches` |

</details>

<details><summary><b>departments.js</b> — 6 endpoints (mounted at /api/departments)</summary>

| Method | Path |
|---|---|
| GET | `/api/departments` |
| GET | `/api/departments/:id` |
| POST | `/api/departments` |
| PUT | `/api/departments/:id` |
| DELETE | `/api/departments/:id` |
| GET | `/api/departments/:id/tasks` |

</details>

<details><summary><b>ems.js</b> — 14 endpoints (mounted at /api/ems)</summary>

| Method | Path |
|---|---|
| POST | `/api/ems/send-task-assignment` |
| POST | `/api/ems/send-task-reminders` |
| POST | `/api/ems/send-overdue-alerts` |
| POST | `/api/ems/send-custom-email` |
| POST | `/api/ems/send-bulk-task-emails` |
| GET | `/api/ems/templates` |
| GET | `/api/ems/scheduled-emails` |
| DELETE | `/api/ems/scheduled-emails/:id` |
| POST | `/api/ems/process-scheduled` |
| GET | `/api/ems/stats` |
| GET | `/api/ems/tasks-for-email` |
| POST | `/api/ems/send-daily-reminders` |
| POST | `/api/ems/send-welcome-email/:userId` |
| POST | `/api/ems/send-password-reset/:userId` |

</details>

<details><summary><b>emsSignals.js</b> — 8 endpoints (mounted at /api/ems-signals)</summary>

| Method | Path |
|---|---|
| POST | `/api/ems-signals/signals/init` |
| POST | `/api/ems-signals/signals` |
| POST | `/api/ems-signals/signals/realtime` |
| GET | `/api/ems-signals/signals/:employeeId` |
| GET | `/api/ems-signals/signals/:employeeId/history` |
| GET | `/api/ems-signals/signals/:employeeId/proof` |
| POST | `/api/ems-signals/signals/:employeeId/stop` |
| DELETE | `/api/ems-signals/signals/:employeeId` |

</details>

<details><summary><b>enhancedAims.js</b> — 4 endpoints (mounted at /api/enhanced-aims)</summary>

| Method | Path |
|---|---|
| GET | `/api/enhanced-aims/with-progress` |
| POST | `/api/enhanced-aims/sync-progress-to-aim` |
| POST | `/api/enhanced-aims/sync-attendance-to-aim` |
| GET | `/api/enhanced-aims/enhanced` |

</details>

<details><summary><b>enhancedAttendance.js</b> — 8 endpoints (mounted at /api/enhanced-attendance)</summary>

| Method | Path |
|---|---|
| POST | `/api/enhanced-attendance/start-day` |
| POST | `/api/enhanced-attendance/end-day` |
| GET | `/api/enhanced-attendance/today-status` |
| GET | `/api/enhanced-attendance/history` |
| POST | `/api/enhanced-attendance/auto-end-day` |
| GET | `/api/enhanced-attendance/live-dashboard` |
| GET | `/api/enhanced-attendance/salary/:userId/:year/:month` |
| GET | `/api/enhanced-attendance/salary-slip/:userId/:year/:month` |

</details>

<details><summary><b>enhancedSalary.js</b> — 5 endpoints (mounted at /api/enhanced-salary)</summary>

| Method | Path |
|---|---|
| POST | `/api/enhanced-salary/upload-biometric` |
| GET | `/api/enhanced-salary/calculate/:userId/:year/:month` |
| GET | `/api/enhanced-salary/dashboard/:year/:month` |
| GET | `/api/enhanced-salary/hours-breakdown/:userId/:year/:month` |
| GET | `/api/enhanced-salary/wfh-analysis/:userId/:year/:month` |

</details>

<details><summary><b>hourlyBasedSalary.js</b> — 9 endpoints (mounted at /api/hourly-salary)</summary>

| Method | Path |
|---|---|
| GET | `/api/hourly-salary/employee/:userId/calculate/:year/:month` |
| GET | `/api/hourly-salary/employee/:userId/hours-breakdown/:year/:month` |
| GET | `/api/hourly-salary/activity-log` |
| GET | `/api/hourly-salary/admin/dashboard/:year/:month` |
| PATCH | `/api/hourly-salary/attendance/:attendanceId/location` |
| POST | `/api/hourly-salary/admin/hourly-rates/bulk-update` |
| GET | `/api/hourly-salary/my-salary/current` |
| GET | `/api/hourly-salary/activity-log/current` |
| GET | `/api/hourly-salary/admin/dashboard/current` |

</details>

<details><summary><b>integrationHealth.js</b> — 1 endpoints (mounted at /api/integration)</summary>

| Method | Path |
|---|---|
| GET | `/api/integration/health` |

</details>

<details><summary><b>leave.js</b> — 7 endpoints (mounted at /api/leave)</summary>

| Method | Path |
|---|---|
| POST | `/api/leave/request` |
| GET | `/api/leave/user/:userId` |
| GET | `/api/leave/pending` |
| PUT | `/api/leave/:id/approve` |
| PUT | `/api/leave/:id/reject` |
| GET | `/api/leave/analytics` |
| PUT | `/api/leave/:id/cancel` |

</details>

<details><summary><b>monitoring.js</b> — 32 endpoints (mounted at /api/monitoring)</summary>

| Method | Path |
|---|---|
| POST | `/api/monitoring/start/:employeeId` |
| POST | `/api/monitoring/stop/:employeeId` |
| POST | `/api/monitoring/start-all` |
| POST | `/api/monitoring/stop-all` |
| GET | `/api/monitoring/employees/:id/activity` |
| GET | `/api/monitoring/employees/:id/screenshots` |
| GET | `/api/monitoring/screenshots/:screenshotId` |
| GET | `/api/monitoring/cloudinary-screenshots/:employeeId` |
| GET | `/api/monitoring/alerts` |
| PUT | `/api/monitoring/alerts/:alertId/acknowledge` |
| PUT | `/api/monitoring/alerts/:alertId/resolve` |
| GET | `/api/monitoring/whitelist` |
| POST | `/api/monitoring/whitelist` |
| GET | `/api/monitoring/reports/:employeeId` |
| GET | `/api/monitoring/status/:employeeId` |
| GET | `/api/monitoring/status/all` |
| GET | `/api/monitoring/ai/test` |
| GET | `/api/monitoring/intelligent/stats` |
| POST | `/api/monitoring/keystroke/:employeeId` |
| GET | `/api/monitoring/keystroke/:employeeId` |
| GET | `/api/monitoring/productivity/:employeeId` |
| POST | `/api/monitoring/report/pdf/:employeeId` |
| POST | `/api/monitoring/report/bulk` |
| POST | `/api/monitoring/export/csv/:employeeId` |
| GET | `/api/monitoring/download/:filename` |
| POST | `/api/monitoring/ocr/test` |
| GET | `/api/monitoring/ocr/status` |
| GET | `/api/monitoring/work-session/:employeeId` |
| POST | `/api/monitoring/work-session/start` |
| POST | `/api/monitoring/work-session/pause` |
| POST | `/api/monitoring/work-session/resume` |
| POST | `/api/monitoring/work-session/end` |

</details>

<details><summary><b>newSalaryManagement.js</b> — 19 endpoints (mounted at /api/new-salary)</summary>

| Method | Path |
|---|---|
| GET | `/api/new-salary/hours/all` |
| GET | `/api/new-salary/debug/attendance` |
| GET | `/api/new-salary/hours/:userId` |
| POST | `/api/new-salary/validate-midnight-span/:recordId` |
| POST | `/api/new-salary/calculate` |
| GET | `/api/new-salary/records/:userId` |
| GET | `/api/new-salary/records` |
| DELETE | `/api/new-salary/records/:recordId` |
| PUT | `/api/new-salary/confirm/:recordId` |
| GET | `/api/new-salary/confirmed` |
| PUT | `/api/new-salary/confirmed/:recordId` |
| DELETE | `/api/new-salary/confirmed/:recordId` |
| GET | `/api/new-salary/history/buckets` |
| GET | `/api/new-salary/history/bucket-details` |
| POST | `/api/new-salary/history/create-bucket` |
| DELETE | `/api/new-salary/history/delete-bucket` |
| GET | `/api/new-salary/spam-users` |
| POST | `/api/new-salary/spam-users/validate` |
| POST | `/api/new-salary/spam-users/bulk-validate` |

</details>

<details><summary><b>notifications.js</b> — 3 endpoints (mounted at /api/notifications)</summary>

| Method | Path |
|---|---|
| POST | `/api/notifications/broadcast-reminders` |
| POST | `/api/notifications/broadcast-aim-reminders` |
| POST | `/api/notifications/toggle-automation` |

</details>

<details><summary><b>procurement.js</b> — 6 endpoints (mounted at /api/procurement)</summary>

| Method | Path |
|---|---|
| POST | `/api/procurement/run-analysis` |
| GET | `/api/procurement/report` |
| GET | `/api/procurement/available-employees` |
| GET | `/api/procurement/top-performers` |
| GET | `/api/procurement/employee-stats/:employeeId` |
| POST | `/api/procurement/auto-analysis` |

</details>

<details><summary><b>progress.js</b> — 6 endpoints (mounted at /api/progress)</summary>

| Method | Path |
|---|---|
| GET | `/api/progress/task/:taskId` |
| GET | `/api/progress/user/:userId` |
| GET | `/api/progress/all` |
| POST | `/api/progress` |
| PUT | `/api/progress/:id` |
| DELETE | `/api/progress/:id` |

</details>

<details><summary><b>projects.js</b> — 12 endpoints (mounted at /api/projects)</summary>

| Method | Path |
|---|---|
| GET | `/api/projects` |
| GET | `/api/projects/:id` |
| POST | `/api/projects` |
| PUT | `/api/projects/:id` |
| DELETE | `/api/projects/:id` |
| POST | `/api/projects/:id/tasks` |
| DELETE | `/api/projects/:id/tasks/:taskId` |
| POST | `/api/projects/:id/team` |
| DELETE | `/api/projects/:id/team/:userId` |
| GET | `/api/projects/:id/stats` |
| GET | `/api/projects/department/:departmentId` |
| POST | `/api/projects/:id/recalculate` |

</details>

<details><summary><b>push.js</b> — 5 endpoints (mounted at /api/push)</summary>

| Method | Path |
|---|---|
| POST | `/api/push/subscribe` |
| POST | `/api/push/cleanup` |
| POST | `/api/push/send` |
| POST | `/api/push/broadcast` |
| GET | `/api/push/subscriptions` |

</details>

<details><summary><b>submission.js</b> — 7 endpoints (mounted at /api/submissions)</summary>

| Method | Path |
|---|---|
| GET | `/api/submissions` |
| GET | `/api/submissions/:id` |
| GET | `/api/submissions/task/:taskId` |
| POST | `/api/submissions` |
| PUT | `/api/submissions/:id` |
| PUT | `/api/submissions/:id/review` |
| DELETE | `/api/submissions/:id` |

</details>

<details><summary><b>tantraExecution.js</b> — 3 endpoints (mounted at /api/tantra)</summary>

| Method | Path |
|---|---|
| GET | `/api/tantra/health` |
| POST | `/api/tantra/execution/participate` |
| GET | `/api/tantra/execution/:executionId/history` |

</details>

<details><summary><b>tasks.js</b> — 8 endpoints (mounted at /api/tasks)</summary>

| Method | Path |
|---|---|
| GET | `/api/tasks/overdue` |
| GET | `/api/tasks` |
| GET | `/api/tasks/stats` |
| GET | `/api/tasks/:id` |
| POST | `/api/tasks` |
| PUT | `/api/tasks/:id` |
| DELETE | `/api/tasks/:id` |
| GET | `/api/tasks/:id/dependencies` |

</details>

<details><summary><b>tester.js</b> — 10 endpoints (mounted at /api/tester)</summary>

| Method | Path |
|---|---|
| GET | `/api/tester/dashboard-stats` |
| GET | `/api/tester/tasks` |
| GET | `/api/tester/departments` |
| GET | `/api/tester/users` |
| GET | `/api/tester/tested-tasks-feed` |
| POST | `/api/tester/evaluations` |
| GET | `/api/tester/evaluations` |
| GET | `/api/tester/evaluations/:id` |
| PUT | `/api/tester/evaluations/:id` |
| GET | `/api/tester/alerts` |

</details>

<details><summary><b>user-notifications.js</b> — 4 endpoints (mounted at /api/user-notifications)</summary>

| Method | Path |
|---|---|
| GET | `/api/user-notifications/:userId` |
| PUT | `/api/user-notifications/:id/read` |
| PUT | `/api/user-notifications/read-all` |
| DELETE | `/api/user-notifications/:id` |

</details>

<details><summary><b>users.js</b> — 15 endpoints (mounted at /api/users)</summary>

| Method | Path |
|---|---|
| GET | `/api/users/search` |
| GET | `/api/users` |
| GET | `/api/users/:id` |
| PUT | `/api/users/:id` |
| PUT | `/api/users/:id/status` |
| PUT | `/api/users/:id/work-mode` |
| PUT | `/api/users/bulk/work-mode` |
| GET | `/api/users/admin/all` |
| DELETE | `/api/users/:id` |
| GET | `/api/users/:id/tasks` |
| PUT | `/api/users/:id/password` |
| GET | `/api/users/:id/submissions` |
| GET | `/api/users/:id/notifications` |
| PUT | `/api/users/:id/notifications/read-all` |
| POST | `/api/users/update-all-stillexist` |

</details>
