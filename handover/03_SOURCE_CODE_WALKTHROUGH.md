# Source Code Walkthrough — Niyantran (workflow-blackhole)

This document is a map, not a tutorial — its job is to answer "where do I find X" and "is this file actually used." Every claim about what's active/dead below comes from cross-referencing `server/index.js` against the route files programmatically (script-generated, not hand-typed), so it reflects the real running app rather than folder contents alone.

## 1. Runtime lifecycle (what happens when the server starts)

1. `server/index.js` loads env vars (`dotenv`), then immediately checks `JWT_SECRET`, `TANTRA_EXECUTION_KEY`, and `MONGODB_URI` — if any are missing, it prints exactly which ones and calls `process.exit(1)` before touching Express at all. **Verified by actually running it with no `.env` present** (see `13_EVIDENCE_PACKET.md`).
2. Express app is constructed; `helmet`, `cors`, rate limiting, and body parsing are attached.
3. Mongoose connects to `MONGODB_URI`.
4. Socket.IO server is attached to the same HTTP server instance.
5. 38 route groups are mounted under `/api/*` (full list in §2).
6. `services/attendanceCronJobs.js` schedules a daily `23:59` job to auto-close the day's attendance/work sessions.
7. The Tesseract.js OCR worker used by the EMS screenshot pipeline initializes.
8. Server listens (default port `5000` per `server/Dockerfile`, or `PORT` env var).

## 2. Route files — every file, its real mount status

`server/routes/` contains 60 files. Only 38 mount points are wired into `index.js`; some route files share a mount point (Express allows this — both routers' paths become reachable under the same prefix). The remaining 22 files are not `require()`-d anywhere outside their own file (confirmed by a repo-wide search) — they represent earlier iterations that were superseded but never deleted.

| Route file | Mount prefix | Status |
|---|---|---|
| `activity.js` | — | Not mounted (dead — file is empty) |
| `admin.js` | `/api/admin` | Active |
| `agent.js` | — | Not mounted (dead — file is empty) |
| `agentActivity.js` | `/api/agent` | Active |
| `ai.js` | `/api/ai` | Active |
| `aiAgents.js` | — | Not a router — helper module imported by `aiRoutes.js` |
| `aiReview.js` | — | Not mounted (superseded) |
| `aiRoutePy.js` | — | Not mounted (superseded — referenced only in a commented-out line) |
| `aiRoutes.js` | `/api/new/ai` | Active |
| `aim.js` | — | Not mounted (superseded) |
| `aimsWithProgress.js` | — | Not mounted (superseded) |
| `aims_unified.js` | — | Not mounted (superseded by `aims_universal.js`) |
| `aims_universal.js` | `/api/aims` | Active |
| `alerts.js` | `/api/alerts` | Active |
| `attendance.js` | `/api/attendance` | Active |
| `attendanceDashboard.js` | `/api/attendance-dashboard` | Active |
| `attendanceDataManagement.js` | — | Not mounted (superseded) |
| `attendanceStatus.js` | `/api/attendance` | Active (shares prefix with `attendance.js`) |
| `attendance_fixed.js` | — | Not mounted (superseded) |
| `attendance_fixed_final.js` | — | Not mounted (superseded) |
| `attendance_no_default_aims.js` | — | Not mounted (superseded) |
| `attendance_upload_fixed.js` | — | Not mounted (superseded) |
| `auth.js` | `/api/auth` | Active |
| `biometricAttendance.js` | `/api/biometric` | Active |
| `biometricAttendanceFixed.js` | — | Not mounted — **and has a real syntax error** (`const debugger = ...`, `debugger` is a reserved word). Harmless only because it's never loaded. |
| `branchRoutes.js` | `/api/branches` | Active |
| `chatbot.js` | `/api/chatbot` | Active |
| `compliance.js` | — | Not mounted (superseded) |
| `consent.js` | `/api/consent` | Active |
| `dashboard.js` | `/api/dashboard` | Active |
| `dashboardFixed.js` | `/api/dashboard` | Active (shares prefix with `dashboard.js`) |
| `departments.js` | `/api/departments` | Active |
| `ems.js` | `/api/ems` | Active |
| `emsSignals.js` | `/api/ems-signals` | Active |
| `enhancedAims.js` | `/api/enhanced-aims` | Active |
| `enhancedAttendance.js` | `/api/enhanced-attendance` | Active |
| `enhancedSalary.js` | `/api/enhanced-salary` | Active |
| `executionVisibility.js` | — | Not mounted (superseded) |
| `hourlyBasedSalary.js` | `/api/hourly-salary` | Active |
| `integrationHealth.js` | `/api/integration` | Active |
| `leave.js` | `/api/leave` | Active |
| `liveAttendance.js` | — | Not mounted (superseded) |
| `monitoring.js` | `/api/monitoring` | Active (largest route file — 32 endpoints) |
| `new.js` | — | Not mounted (superseded / scratch file) |
| `newSalaryManagement.js` | `/api/new-salary` | Active |
| `notifications.js` | `/api/notifications` | Active |
| `procurement.js` | `/api/procurement` | Active |
| `progress.js` | `/api/progress` | Active |
| `projects.js` | `/api/projects` | Active |
| `push.js` | `/api/push` | Active |
| `salaryManagement.js` | — | Not mounted (superseded) |
| `salaryRoutes.js` | — | Not mounted (superseded) |
| `submission.js` | `/api/submissions` | Active |
| `tantraExecution.js` | `/api/tantra` | Active |
| `tasks.js` | `/api/tasks` | Active |
| `testProgress.js` | — | Not mounted (test/scratch file) |
| `testSync.js` | — | Not mounted (test/scratch file) |
| `tester.js` | `/api/tester` | Active |
| `user-notifications.js` | `/api/user-notifications` | Active |
| `users.js` | `/api/users` | Active |

**Recommendation:** the 22 "not mounted" files are safe to archive or delete — none of them are referenced anywhere else in the codebase (verified by grepping every `require()` in the repo, not just `index.js`). Keeping them adds real risk: a future engineer could reasonably assume `attendance_fixed_final.js` is the current implementation because of its name, when the actual active file is `attendance.js`.

## 3. Services (`server/services/`, 36 files) — grouped by purpose

| Group | Files |
|---|---|
| Attendance & payroll | `attendanceCronJobs.js`, `attendanceSalaryService.js`, `attendanceService.js`, `biometricProcessor.js`, `enhancedBiometricProcessor.js`, `enhancedSalaryCalculator.js`, `salaryCalculator.js`, `workingHoursCalculator.js`, `excelProcessor.js`, `geolocationService.js` |
| Employee monitoring (EMS) | `activityTracker.js`, `emsAutomation.js`, `ems_signals.js`, `intelligentScreenCapture.js`, `screenCapture.js`, `keystrokeAnalytics.js`, `ocrAnalysisService.js`, `websiteMonitor.js` |
| AI integration | `aiReviewService.js`, `groqAIService.js`, `groqService.js` |
| Ecosystem / TANTRA participation | `bucketClient.js`, `karmaClient.js`, `setuDispatcher.js`, `executionContractService.js`, `executionEventEmitter.js`, `executionLineageAdapter.js`, `executionRejectionLogger.js`, `executionReplayLog.js`, `taskExecutionBridge.js`, `eventBus.js` (Redis pub/sub with in-process fallback) |
| Compliance / audit | `auditLogService.js`, `complianceAuditLogger.js`, `consentManager.js` |
| Procurement | `procurementAgent.js` |
| Reporting | `reportGenerator.js` |

The **ecosystem/TANTRA group is the most important one to understand for cross-system work** — it's the code that actually implements Niyantran's side of the contract described in `ECOSYSTEM_REPOSITORY_MAP.md`. It's also the best-tested part of the codebase: `bucketClient.js`, `karmaClient.js`, `eventBus.js`, and the TANTRA execution/integration-health routes each have a dedicated, passing Jest suite (see `13_EVIDENCE_PACKET.md`).

## 4. Middleware (`server/middleware/`, 11 files)

| File | Purpose |
|---|---|
| `auth.js` | JWT verification via `x-auth-token` header. Refuses to load if `JWT_SECRET` is unset (throws at require-time, not just at request-time). |
| `adminAuth.js` | Requires `req.user.role` to be `Admin` or `Manager`. Must be chained after `auth.js`. |
| `tenantIsolation.js` | Multi-tenant scoping guard (has a dedicated passing test suite). |
| `executionAuth.js` | Gates the `/api/tantra` execution routes against `TANTRA_EXECUTION_KEY`. |
| `governanceEnforcement.js` | Enforces ecosystem governance rules on relevant routes. |
| `traceContinuity.js` | Propagates correlation/trace IDs for cross-system lineage. |
| `branchMiddleware.js` | Branch-scoping for multi-branch orgs. |
| `complianceAuth.js`, `procurementAuth.js`, `testerAuth.js` | Role/feature-specific auth gates. |
| `aimSync.js` | Middleware counterpart to `utils/aimSync.js` (goal/"aim" synchronization). |

## 5. Utils (`server/utils/`, 12 files) and Controllers (3 files)

Utils hold shared, stateless helpers: `cloudinary.js` (upload wrapper), `emailService.js` (SMTP wrapper), `pushNotificationService.js` (web-push/VAPID), `reverseGeocode.js` and `attendanceMergeLogic.js`/`attendanceDataMigration.js`/`attendanceDebugger.js` (attendance data hygiene), `biometricIdentityResolver.js`, `stableStringify.js`, `orgEmail.js`, `excelProcessor.js`.

Controllers are used by only three domains — `enhancedSalaryController.js`, `hourlyBasedSalaryController.js`, `salaryController.js` — everything else keeps logic inline in the route file, which is a real (if minor) inconsistency in code style worth knowing about before you go looking for "the controller" for a given route and don't find one.

## 6. Frontend (`client/src/`)

React 18 + Vite. Structure (verified):

```
src/
├── components/    admin, aims, attendance, dashboard, departments, dependencies,
│                  leave, monitoring, notifications, optimization, progress,
│                  salary, settings, tasks, ui
├── context/       React context providers (auth/session state)
├── hooks/         custom hooks
├── layouts/       page shells
├── lib/api.js     ← the single Axios client; this is where the x-auth-token header is attached
├── pages/         route-level views
├── services/      per-domain API call wrappers (e.g. enhancedSalaryAPI.js)
├── styles/, types/, utils/, assets/
```

Build verified: `npm ci && npm run build` succeeds and produces a deployable `dist/` (see `13_EVIDENCE_PACKET.md`). One build-time warning: the main JS chunk is ~987 KB (261 KB gzipped) — functional but a candidate for code-splitting.

## 7. Configuration & build files worth knowing about

| File | Purpose |
|---|---|
| `server/package.json` | Backend dependencies/scripts (`npm start`, `npm test`) |
| `client/package.json` | Frontend dependencies/scripts (`npm run dev`, `npm run build`) |
| `docker-compose.yml` / `docker-compose.production.template.yml` | Dev vs. production container topology — see `04_DEPLOYMENT_GUIDE.md` |
| `.env.example` | Documents 20 of the ~65 environment variables actually read by the code — see Known Issues |
| `.github/workflows/cicd.yml` | The one CI/CD pipeline definition |
| `server/tests/*.test.js` | 6 Jest suites, all passing — the closest thing to a regression safety net for this codebase |
