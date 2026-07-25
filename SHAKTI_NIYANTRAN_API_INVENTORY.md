# SHAKTI–NIYANTRAN Engineering Execution API Inventory

## Purpose
This document inventories the backend GET endpoints in the workspace that can expose engineering execution, monitoring, telemetry, health, and dashboard-related data for the SHAKTI–NIYANTRAN Operational Command Center integration.

## Scope
The focus is on endpoints that can support:
- execution state and trace visibility
- monitoring and telemetry feeds
- health checks and runtime readiness
- dashboard-oriented operational data
- activity/session visibility
- real-time or near-real-time monitoring data

## Base Routing Notes
The server mounts the relevant routes under these prefixes:
- /api/monitoring
- /api/attendance-dashboard
- /api/agent
- /api/biometric
- /api/dashboard
- /api/tantra
- /api/ems-signals
- /api/attendance
- /api/alerts

## Authentication and Access Notes
- Many endpoints are protected by the shared auth middleware and require an x-auth-token header.
- Some execution endpoints require x-execution-key or a valid admin/manager token via the executionAuth middleware.
- The TANTRA health endpoint is explicitly intended to be reachable without credentials for monitoring systems.
- Several monitoring endpoints currently do not enforce auth in the code and are effectively open for internal use.

---

## 1. Execution and Trace Visibility

### 1.1 GET /api/tantra/health
- Description: Liveness and readiness probe for the TANTRA execution runtime.
- Data Provided: Service health status, MongoDB readiness, model availability, runtime version, uptime, environment.
- Response Format: JSON object with service, version, status, timestamp, components, runtime.
- Auth: No auth required.
- Integration Value: Good for uptime and readiness checks from SHAKTI/NIYANTRAN.

### 1.2 GET /api/tantra/execution/:executionId/history
- Description: Retrieves full execution history for a given execution ID.
- Data Provided: Execution session, events, lineage, rejections, trace information.
- Response Format: JSON object with status, execution_id, trace_id, tenant_id, session, events, lineage, rejections.
- Auth: Requires executionAuth (x-execution-key or admin/manager auth token).
- Integration Value: Best endpoint for reconstructing execution timelines and lineage for the dashboard.

### 1.3 GET /api/execution/task/:taskId/state
- Description: Returns the current execution state for a task based on its task ID.
- Data Provided: Task execution state, execution ID, trace ID, last timestamp, tenant ID, and a condensed event list.
- Response Format: JSON object with task_id, execution_id, state, trace_id, timestamp, tenant_id, events.
- Auth: Requires executionAuth.
- Integration Value: Useful for task-level execution status visibility.

### 1.4 GET /api/execution/submission/:submissionId/state
- Description: Returns execution state for a task submission.
- Data Provided: Submission ID, execution ID, state, trace ID, timestamp, tenant ID, event type.
- Response Format: JSON object with submission_id, execution_id, state, trace_id, timestamp, tenant_id, event_type.
- Auth: Requires executionAuth.
- Integration Value: Supports submission-level execution monitoring.

### 1.5 GET /api/execution/trace/:traceId/status
- Description: Returns execution status keyed by trace ID.
- Data Provided: Trace ID, execution ID, state, tenant ID, timestamp, event timeline.
- Response Format: JSON object with trace_id, execution_id, state, tenant_id, timestamp, timeline.
- Auth: Requires executionAuth.
- Integration Value: Critical for trace-based operations and incident investigations.

### 1.6 GET /api/execution/tenant/:tenantId/events
- Description: Returns recent execution events for a tenant.
- Data Provided: Execution events for a tenant, optionally filtered by event type.
- Response Format: JSON object with tenant_id, count, events array.
- Auth: Requires executionAuth.
- Integration Value: Good for tenant-scoped execution feeds and operational dashboards.

---

## 2. Monitoring, Telemetry, and Activity Feeds

### 2.1 GET /api/monitoring/employees/:id/activity
- Description: Retrieves activity logs for a specific employee.
- Data Provided: Activity records, real-time status, total count.
- Response Format: JSON object with activities, realtimeStatus, totalCount.
- Auth: No auth middleware in the code shown; likely internal/open depending on deployment.
- Integration Value: Strong source for employee-level activity telemetry.

### 2.2 GET /api/monitoring/employees/:id/screenshots
- Description: Returns violation screenshots for a specific employee.
- Data Provided: Screenshot metadata and violation-only images, with filters by date/range/limit.
- Response Format: JSON object with screenshots, totalCount, message.
- Auth: No auth middleware in the code shown.
- Integration Value: Useful for audit, incident review, or visual evidence in the dashboard.

### 2.3 GET /api/monitoring/screenshots/:screenshotId
- Description: Serves a specific screenshot by ID.
- Data Provided: Screenshot binary or redirect to stored image.
- Response Format: Image content or redirect.
- Auth: No auth middleware in the code shown.
- Integration Value: Good for detailed evidence display in the UI.

### 2.4 GET /api/monitoring/cloudinary-screenshots/:employeeId
- Description: Returns Cloudinary-hosted violation screenshots for an employee.
- Data Provided: Screenshot links and metadata merged with DB record metadata.
- Response Format: JSON object with success, screenshots, total, storage_type, date.
- Auth: No auth middleware in the code shown.
- Integration Value: Useful for fast UI rendering of evidence assets.

### 2.5 GET /api/monitoring/alerts
- Description: Fetches monitoring alerts.
- Data Provided: Active or historical alerts, optionally filtered by employee, severity, or status.
- Response Format: JSON object with alerts and totalCount.
- Auth: No auth middleware in the code shown.
- Integration Value: Useful for alerting and incident correlation.

### 2.6 GET /api/monitoring/whitelist
- Description: Returns approved website whitelist entries.
- Data Provided: Approved domains and metadata such as category and monitoring level.
- Response Format: JSON object with whitelist and totalCount.
- Auth: No auth middleware in the code shown.
- Integration Value: Relevant to policy and access monitoring context.

### 2.7 GET /api/monitoring/reports/:employeeId
- Description: Generates a monitoring report for an employee over a date range.
- Data Provided: Activity summary, daily metrics, alert statistics, screenshots summary.
- Response Format: JSON object with employeeId, reportPeriod, activitySummary, dailyMetrics, alertStats, screenshots.
- Auth: No auth middleware in the code shown.
- Integration Value: Strong candidate for operational report views.

### 2.8 GET /api/monitoring/status/:employeeId
- Description: Returns current monitoring status for one employee.
- Data Provided: Activity tracker status, website monitor status, monitoring service state.
- Response Format: JSON object with employeeId, timestamp, activity, website, monitoring.
- Auth: No auth middleware in the code shown.
- Integration Value: Suitable for near-real-time dashboard tiles.

### 2.9 GET /api/monitoring/status/all
- Description: Returns monitoring status for all employees, optionally filtered by branch.
- Data Provided: Per-employee monitoring state, activity/website status, violation counts, mode, last activity.
- Response Format: JSON object with employees array and summary object.
- Auth: No auth middleware in the code shown.
- Integration Value: Probably the most relevant endpoint for a live operations dashboard.

### 2.10 GET /api/monitoring/intelligent/stats
- Description: Returns intelligent monitoring statistics for violations.
- Data Provided: Total violations, unique employees, by-employee counts, content types, risk levels, task relevance scores.
- Response Format: JSON object with aggregated stats.
- Auth: No auth middleware in the code shown.
- Integration Value: Good for analytics panels and risk summaries.

### 2.11 GET /api/monitoring/keystroke/:employeeId
- Description: Returns keystroke analytics for an employee.
- Data Provided: Keystroke-based analytics over a date range.
- Response Format: JSON object with analytics.
- Auth: No auth middleware in the code shown.
- Integration Value: Useful for productivity/behavior telemetry.

### 2.12 GET /api/monitoring/productivity/:employeeId
- Description: Returns a productivity summary for an employee.
- Data Provided: Productivity summary output from the keystroke analytics service.
- Response Format: JSON object with summary.
- Auth: No auth middleware in the code shown.
- Integration Value: Good for dashboard productivity KPIs.

### 2.13 GET /api/ems-signals/signals/:employeeId
- Description: Returns the current signal state for an employee.
- Data Provided: Current signal tracking state and statistics.
- Response Format: JSON object from emsSignals.getSignalState(employeeId).
- Auth: No auth middleware in the code shown.
- Integration Value: Good for real-time engineering activity tracking.

### 2.14 GET /api/ems-signals/signals/:employeeId/history
- Description: Returns signal history in a time range.
- Data Provided: Historical signals and count.
- Response Format: JSON object with employeeId, timeRange, signals, count.
- Auth: No auth middleware in the code shown.
- Integration Value: Useful for timeline-based analytics.

### 2.15 GET /api/ems-signals/signals/:employeeId/proof
- Description: Returns live capture proof for an employee.
- Data Provided: Proof payload for the current capture state.
- Response Format: JSON object from the signal service.
- Auth: No auth middleware in the code shown.
- Integration Value: Useful during incident triage or verification.

---

## 3. Dashboard and Operational Visibility

### 3.1 GET /api/attendance-dashboard/locations
- Description: Returns live attendance with locations and aims for employees.
- Data Provided: Employee presence, location, start/end times, work status, aim details, summary stats.
- Response Format: JSON object with success, data.employees, data.stats, date.
- Auth: Requires auth and adminAuth.
- Integration Value: One of the strongest dashboard feeds for live operations.

### 3.2 GET /api/attendance-dashboard/start-time-summary
- Description: Returns start-time summary with aims and attendance-based start data.
- Data Provided: Distribution of employee start times, department summary, hourly distribution.
- Response Format: JSON object with summary statistics and grouped data.
- Auth: Requires auth and adminAuth.
- Integration Value: Useful for shift and workday monitoring dashboards.

### 3.3 GET /api/attendance-dashboard/attendance-tracking
- Description: Returns attendance tracking details for a selected date and branch.
- Data Provided: Attendance status, start times, work locations, daily summaries.
- Response Format: JSON object with trackings and summary stats.
- Auth: Requires auth and adminAuth.
- Integration Value: Useful for daily operational oversight.

### 3.4 GET /api/attendance-dashboard/dashboard-data
- Description: Returns dashboard data for attendance monitoring.
- Data Provided: Summary metrics and records for the selected day/branch.
- Response Format: JSON object with success, data, date.
- Auth: Requires auth and adminAuth.
- Integration Value: Good for main admin dashboard panels.

### 3.5 GET /api/biometric/dashboard-kpis
- Description: Returns today’s KPI aggregations for biometric attendance.
- Data Provided: Dashboard KPI values related to attendance and salary processing.
- Response Format: JSON object with success and data.
- Auth: Requires auth.
- Integration Value: Useful if SHAKTI/NIYANTRAN also consumes workforce attendance data.

### 3.6 GET /api/biometric/detailed-logs
- Description: Returns detailed biometric attendance logs.
- Data Provided: Attendance log records for selected date range and filters.
- Response Format: JSON object with success and data.
- Auth: Requires auth.
- Integration Value: Good for audit and detailed monitoring views.

### 3.7 GET /api/biometric/employee-aggregates
- Description: Returns aggregated employee-level attendance data.
- Data Provided: Employee-wise attendance aggregates over a date range.
- Response Format: JSON object with success and data.
- Auth: Requires auth.
- Integration Value: Useful for workforce-level operational summaries.

### 3.8 GET /api/dashboard/stats
- Description: Returns task/dashboard stats for the platform.
- Data Provided: Total tasks, completed/in-progress/pending tasks, tester approvals, change percentages.
- Response Format: JSON object with counts and change metrics.
- Auth: No auth middleware in the code shown.
- Integration Value: Good for general engineering operations dashboards.

### 3.9 GET /api/dashboard/departments
- Description: Returns task statistics by department.
- Data Provided: Department-level task counts and completion metrics.
- Response Format: JSON array of department stats.
- Auth: No auth middleware in the code shown.
- Integration Value: Useful for cross-functional operational views.

### 3.10 GET /api/dashboard/tasks-overview
- Description: Returns task distribution by status and priority.
- Data Provided: Status and priority breakdowns.
- Response Format: JSON object with statusData and priorityData.
- Auth: No auth middleware in the code shown.
- Integration Value: Good for execution backlog visualization.

### 3.11 GET /api/dashboard/activity
- Description: Returns recent activity examples.
- Data Provided: Mock or sample recent activity feed.
- Response Format: JSON array of activity items.
- Auth: No auth middleware in the code shown.
- Integration Value: Useful as a placeholder or fallback feed.

### 3.12 GET /api/dashboard/user-stats/:userId
- Description: Returns user-related dashboard stats.
- Data Provided: User-specific stats; implementation not fully shown here.
- Response Format: Not fully visible in the snippet reviewed.
- Auth: No auth middleware in the code shown.
- Integration Value: Useful for personalized dashboard views.

### 3.13 GET /api/dashboard/attendance-summary
- Description: Return attendance dashboard data with merge status.
- Data Provided: Daily attendance records, merge details, salary context, summary stats.
- Response Format: JSON object with success, dateRange, summary, records, count.
- Auth: Requires auth.
- Integration Value: Valuable for workforce operations and reconciliation dashboards.

### 3.14 GET /api/dashboard/merge-analysis
- Description: Returns merge-case analysis for attendance reconciliation.
- Data Provided: Merge case counts, mismatch breakdowns, mapping issues, time difference distributions.
- Response Format: JSON object with analysis metrics.
- Auth: Requires auth.
- Integration Value: Good for operational exception analysis.

---

## 4. Session, Activity, and Worker State Endpoints

### 4.1 GET /api/agent/activity/summary/:userId
- Description: Returns an activity summary for one user for the current day.
- Data Provided: Total logs, keystrokes, mouse activity, idle seconds, productivity score, recent logs.
- Response Format: JSON object with success and summary.
- Auth: Requires auth and restricts access to the same user or admin.
- Integration Value: Useful for desktop-agent activity summaries.

### 4.2 GET /api/attendance/status
- Description: Returns the current workday status for the authenticated employee.
- Data Provided: Whether the day has started, start time, attendance ID, work location.
- Response Format: JSON object with dayStarted, startTime, attendanceId, workLocation, location.
- Auth: Requires auth.
- Integration Value: Good for polling whether an engineering work session is active.

### 4.3 GET /api/alerts
- Description: Returns monitoring alerts for the authenticated user.
- Data Provided: Alerts associated with the user’s employee record.
- Response Format: JSON array of alerts.
- Auth: Requires auth.
- Integration Value: Useful for user-level incident visibility.

---

## 5. Recommended Integration Priorities for SHAKTI–NIYANTRAN

The highest-value endpoints for the integration are:
1. /api/tantra/health — service readiness and liveness.
2. /api/tantra/execution/:executionId/history — full execution history.
3. /api/execution/task/:taskId/state — task-level state.
4. /api/execution/trace/:traceId/status — trace-level execution status.
5. /api/monitoring/status/all — live operational monitoring overview.
6. /api/monitoring/employees/:id/activity — per-employee activity telemetry.
7. /api/monitoring/alerts — alert feed.
8. /api/attendance-dashboard/locations — live workforce presence and location data.
9. /api/attendance-dashboard/dashboard-data — dashboard summary data.
10. /api/agent/activity/summary/:userId — agent-derived activity summary.

---

## Notes for Engineering Teams
- Several monitoring-style endpoints appear to be intentionally open or lightly protected; if these are exposed externally, they should be reviewed for security and least-privilege access.
- For production integration, a gateway layer or auth mapping is recommended so SHAKTI and NIYANTRAN can consume these feeds without directly depending on internal-only middleware behavior.
- If the integration needs streaming or push-based updates rather than polling, the existing Socket.IO setup in the main server may be worth extending for event-driven delivery.
