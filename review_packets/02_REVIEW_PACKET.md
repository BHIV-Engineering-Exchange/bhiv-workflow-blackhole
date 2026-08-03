# Review Packet 02 — AllAims & CompletedTasks Bug Fixes
**Repo**: bhiv-workflow-blackhole  
**Date**: July 28, 2026  
**Reviewer**: Amazon Q  

---

## Summary

5 bug areas fixed across 6 files. Covers the AllAims page (data not loading, Manager seeing 0 aims, wrong stats counters) and the CompletedTasks page (submission filters broken, page reset, spinner, separate fetch returning incomplete data).

---

## Issue 1 — AllAims Page Showing No Data

### Root Causes (3 layered bugs)

**Bug A — Infinite re-render loop**  
`toast` was listed as a dependency in `useCallback` for `fetchData`. Since `toast` is a new reference on every render, this caused `fetchData` to be recreated → `useEffect` to re-fire → fetch → re-render → repeat infinitely. Data was being fetched and immediately overwritten.

**Bug B — UTC timezone shift on date**  
Date was sent as `.toISOString()` (e.g. `2026-07-28T18:30:00.000Z`). Server is in IST (UTC+5:30). When parsed with `new Date(date)`, the server interpreted this as July 27 at midnight IST — one day behind. No aims were found because the query was for the wrong day.

**Bug C — Broken enhanced-aims route**  
`AllAims.jsx` was calling `/api/enhanced-aims` which crashed silently in a `Promise.all` loop. The fallback also failed. No data ever reached the client.

### Fix
- Removed `toast` from `useCallback` deps
- Send date as `yyyy-MM-dd` string; server parses using local date components (`new Date(year, month-1, day)`)
- Replaced broken `/api/enhanced-aims` call with direct `/api/aims/with-progress`

### Files Changed
- `client/src/pages/AllAims.jsx`
- `server/routes/aims_universal.js`

---

## Issue 2 — Manager Seeing 0 Aims

### Root Causes (2 bugs)

**Bug A — Role check too strict**  
`/with-progress` route had `if (req.user.role !== 'Admin')` — Manager fell into the non-admin branch and only fetched their own single aim record instead of all branch users' aims.

**Bug B — Stale JWT branch value**  
Login route had `branch: user.branch || 'mumbai'` as fallback. Manager's token was signed with `branch: 'mumbai'` (not `'blackhole_mumbai'`). Even after fixing the role check, the branch filter matched 0 DB users.

### Fix
- Manager now treated same as Admin — fetches all users in their branch
- Manager's branch always fetched fresh from DB (`User.findById`) instead of trusting `req.user.branch` from JWT — works immediately without re-login
- Fixed login fallback: `'mumbai'` → `'blackhole_mumbai'`

### Files Changed
- `server/routes/aims_universal.js`
- `server/routes/auth.js`

---

## Issue 3 — Stats Counter Wrong (Total: 29, Set: 0, Not Set: 29)

### Root Causes (3 bugs)

**Bug A — `aim.aim` typo**  
"Aims Set" counter checked `aim.aim` (undefined). The field is `aim.aims`. Result: always 0.

**Bug B — Total Users counted from aims array**  
"Total Users" built a Set from the `aims` array (users who already have aims). It could never be larger than "Aims Set".

**Bug C — Aims Not Set always 0**  
Derived as `Total - Set`. Since both were wrong in the same direction, result was always 0.

### Fix
- Server returns `totalUsers` = `User.countDocuments({ stillExist: 1, branch: effectiveBranch })`
- Client stores in `totalUsers` state
- Stats: `Total Users = totalUsers`, `Aims Set = aims.length`, `Aims Not Set = totalUsers - aims.length`

### Files Changed
- `server/routes/aims_universal.js`
- `client/src/pages/AllAims.jsx`

---

## Issue 4 — Dead Route Cleanup

`enhancedAims.js` was mounted at `/api/enhanced-aims` — a full duplicate of `aims_universal.js` with the same bugs (wrong role check, UTC date parsing). No client code called it.

### Fix
- Removed `require` and `app.use` for `enhancedAims` from `index.js`

### Files Changed
- `server/index.js`

---

## Issue 5 — CompletedTasks Submission Filters Broken

### Root Causes (4 bugs)

**Bug A — Separate `/submissions` fetch only returned 20 of 2227 submissions**  
Submission status filters (Pending/Approved/Rejected) operated on this incomplete set — wrong tasks shown.

**Bug B — Submissions tab filter**  
Submissions tab was filtering incorrectly due to the incomplete data from the separate fetch.

**Bug C — Page not resetting on filter change**  
Changing filters didn't reset page to 1 — users landed on empty pages.

**Bug D — Loading spinner**  
Spinner not showing/hiding correctly during fetches.

### Fix
- Server uses `$lookup` aggregation to embed latest submission directly in each task as `task.submission`
- Client removed separate `/submissions` fetch and `submissions` state entirely
- `getSubmissionForTask(task)` reads `task.submission` directly
- `submissionStatus` filter handled at DB level via `$lookup` + `$match` on `_sub.0.status`
- `noSubmission` filter skips `status: "Completed"` constraint so incomplete tasks with no submission also appear
- Page resets to 1 on every filter change

### Files Changed
- `server/routes/tasks.js`
- `client/src/pages/CompletedTasks.jsx`

---

## Files Changed — Full List

| # | File | Type | Change |
|---|---|---|---|
| 1 | `client/src/pages/AllAims.jsx` | Frontend | Fixed fetchData deps, date format, totalUsers state, stat counters |
| 2 | `client/src/pages/CompletedTasks.jsx` | Frontend | Removed submissions state, fixed filters, page reset, spinner |
| 3 | `server/routes/aims_universal.js` | Backend | Manager role access, DB branch lookup, local date parsing, totalUsers in response |
| 4 | `server/routes/auth.js` | Backend | Fixed login JWT branch fallback `'mumbai'` → `'blackhole_mumbai'` |
| 5 | `server/routes/tasks.js` | Backend | $lookup aggregation, embedded submission, submissionStatus filter |
| 6 | `server/index.js` | Backend | Removed dead enhancedAims route |

---

## No Regressions Expected

- All other routes in `aims_universal.js` untouched
- Manager role change is additive — Admin behaviour unchanged
- `totalUsers` is a new field in response — existing consumers unaffected
- Task aggregation pipeline only adds `$lookup` for `status=Completed` — other status queries unchanged

---

## Issue 6 — Task Tab Departments/Dependencies Dropdowns Broken

### Root Cause
`api.tasks.getTasks()` was called without the required `limit` param → server returned 400 error → entire `Promise.all` (departments + users + tasks) failed silently → dropdowns empty.

### Fix
- Pass `{ limit: 100, page: 1 }` to `getTasks()`
- Handle paginated response shape `{ tasks: [...] }` instead of expecting a plain array

### Files Changed
- `client/src/components/tasks/create-task-dialog.jsx`

---

## Issue 7 — Task Filters & Search Broken

### Root Causes (2 bugs)

**Bug A — Uncontrolled checkboxes**
Filter checkboxes had no `checked` prop → visually broken, state not reflected in UI.

**Bug B — Filters passed to backend**
Array filters were passed to the backend which ignores arrays → filtering had no effect. All filtering was happening on an incomplete dataset.

### Fix
- Added `checked={status.includes(stat)}` and `checked={department.includes(dept._id)}` to checkboxes
- Added Reset Filters button with "Active" badge when filters are applied
- Moved filtering to client-side `useMemo` with correct dependency array `[tasks, filters.status, filters.department, filters.priority, searchQuery]`

### Files Changed
- `client/src/components/tasks/task-filters.jsx`
- `client/src/components/tasks/tasks-list.jsx`

---

## Issue 8 — New Task Not Appearing Without Page Reload

### Root Cause
No callback chain existed after task creation — the new task object was never propagated to the task list's local state.

### Fix
- `Tasks.jsx` holds `newTask` state → passes `onTaskCreated={setNewTask}` to `TasksHeader` → forwarded to `CreateTaskDialog` → dialog calls `onTaskCreated(result)` after successful POST
- `TasksList` watches `newTask` prop and prepends it to local state
- Fixed socket handlers for `task-updated` / `task-deleted` using `window.dispatchEvent` custom events
- Delete removes task from local state immediately without refetch

### Files Changed
- `client/src/pages/Tasks.jsx`
- `client/src/components/tasks/tasks-header.jsx`
- `client/src/components/tasks/create-task-dialog.jsx`
- `client/src/components/tasks/tasks-list.jsx`

---

## Issue 9 — Task Pagination & Count Display

### Root Cause
No pagination controls existed. All tasks were attempted to be loaded at once which caused 2435 tasks rendered on a single page.

### Fix
- Added summary bar: "Showing X–Y of Z tasks · Page N of M"
- Implemented proper server-side pagination — single fetch per page (100 tasks max)
- Added pagination controls with ellipsis (« ‹ 1 2 3 … N › »)
- Filters reset to page 1 on change

### Files Changed
- `client/src/components/tasks/tasks-list.jsx`

---

## Issue 10 — Start Day From Office Failing (WFH Working)

### Root Causes (2 bugs)

**Bug A — Wrong API endpoint**
`api.attendance.startDay` called `/attendance/start-day/:userId` (old route). This route has `OFFICE_RADIUS = 100m` hardcoded. WFH skips the distance check entirely which is why WFH worked.

**Bug B — Frontend radius mismatch**
`EnhancedStartDayDialog.jsx` had `OFFICE_RADIUS = 2000m` — showed "At Office ✅" to the user. Backend used `100m` → rejected the request. User saw success UI but got a backend error.

### Fix
- `api.attendance.startDay` now calls `/enhanced-attendance/start-day` (correct route, uses auth token, no userId in path)
- Frontend `OFFICE_RADIUS` corrected to `100m` to match backend default so user sees accurate "Outside office range" status before submitting

### Files Changed
- `client/src/lib/api.js`
- `client/src/components/attendance/EnhancedStartDayDialog.jsx`

---

## Updated Files Changed — Full List (All Issues)

| # | File | Type | Change |
|---|---|---|---|
| 1 | `client/src/pages/AllAims.jsx` | Frontend | Fixed fetchData deps, date format, totalUsers state, stat counters |
| 2 | `client/src/pages/CompletedTasks.jsx` | Frontend | Removed submissions state, fixed filters, page reset, spinner |
| 3 | `server/routes/aims_universal.js` | Backend | Manager role access, DB branch lookup, local date parsing, totalUsers in response |
| 4 | `server/routes/auth.js` | Backend | Fixed login JWT branch fallback `'mumbai'` → `'blackhole_mumbai'` |
| 5 | `server/routes/tasks.js` | Backend | $lookup aggregation, embedded submission, submissionStatus filter |
| 6 | `server/index.js` | Backend | Removed dead enhancedAims route |
| 7 | `client/src/components/tasks/create-task-dialog.jsx` | Frontend | Fixed getTasks call with limit param, handles paginated response |
| 8 | `client/src/components/tasks/task-filters.jsx` | Frontend | Controlled checkboxes, Reset Filters button, Active badge |
| 9 | `client/src/components/tasks/tasks-list.jsx` | Frontend | Client-side filtering, server-side pagination, newTask prepend, socket handlers |
| 10 | `client/src/pages/Tasks.jsx` | Frontend | newTask state, onTaskCreated callback |
| 11 | `client/src/components/tasks/tasks-header.jsx` | Frontend | Forwards onTaskCreated to CreateTaskDialog |
| 12 | `client/src/lib/api.js` | Frontend | startDay endpoint → `/enhanced-attendance/start-day` |
| 13 | `client/src/components/attendance/EnhancedStartDayDialog.jsx` | Frontend | OFFICE_RADIUS corrected 2000m → 100m |
