# Code Packet 02 — AllAims & CompletedTasks Bug Fixes
**Repo**: bhiv-workflow-blackhole  
**Date**: July 28, 2026  

---

## 1. `client/src/pages/AllAims.jsx`

### 1a. totalUsers state added
```jsx
// BEFORE:
const [aims, setAims] = useState([])

// AFTER:
const [aims, setAims] = useState([])
const [totalUsers, setTotalUsers] = useState(0)
```

### 1b. fetchData — removed toast dep, yyyy-MM-dd date, parallel fetch, direct API call, totalUsers stored
```jsx
// BEFORE:
// - toast in useCallback deps → infinite re-render
// - date: selectedDate.toISOString() → UTC shift, wrong day on IST server
// - called /api/enhanced-aims → crashed silently
// - submissions fetched separately

// AFTER:
const fetchData = useCallback(async () => {
  try {
    setIsLoading(true)
    const token = localStorage.getItem('WorkflowToken')
    const selectedBranch = localStorage.getItem('selectedBranch')
    const headers = {
      'x-auth-token': token,
      ...(selectedBranch && selectedBranch !== 'all' && { 'x-branch': selectedBranch })
    }

    const [departmentsResponse, aimsResponse] = await Promise.all([
      axios.get(`${API_URL}/departments`, { headers }),
      axios.get(`${API_URL}/aims/with-progress`, {
        headers,
        params: {
          ...(selectedDepartment && selectedDepartment !== 'all' && { department: selectedDepartment }),
          date: format(selectedDate, 'yyyy-MM-dd')  // ✅ local date string, not ISO
        }
      })
    ])

    const deptsData = departmentsResponse.data?.data ?? departmentsResponse.data
    setDepartments(Array.isArray(deptsData) ? deptsData : [])

    const aimsData = aimsResponse.data?.data ?? aimsResponse.data
    setAims(Array.isArray(aimsData) ? aimsData : [])
    setTotalUsers(aimsResponse.data?.totalUsers ?? (Array.isArray(aimsData) ? aimsData.length : 0))
  } catch (error) {
    console.error('Error fetching aims data:', error.response?.data || error.message)
    toast({ title: 'Error', description: 'Failed to load aims data', variant: 'destructive' })
  } finally {
    setIsLoading(false)
  }
}, [selectedDate, selectedDepartment])  // ✅ toast removed from deps
```

### 1c. Stats counters — fixed field name and source
```jsx
// BEFORE (all broken):
// Total Users: counted unique users from aims array → same as Aims Set
// Aims Set:    checked aim.aim (undefined) → always 0
// Aims Not Set: allUsers.size - usersWithAims.size → always 0

// AFTER:
<span>Total Users: {totalUsers}</span>
<span>Aims Set: {aims.length}</span>
<span>Aims Not Set: {Math.max(0, totalUsers - aims.length)}</span>
```

---

## 2. `server/routes/aims_universal.js` — GET `/with-progress`

### 2a. effectiveBranch hoisted, Manager role added, DB branch lookup
```js
// BEFORE:
// if (req.user.role !== 'Admin') {
//   aimFilter.user = req.user.id;  // Manager only saw their own aim
// }

// AFTER:
const aimFilter = {};
let effectiveBranch = branchQuery.branch;  // hoisted — used later for totalUsers

if (req.user.role === 'Admin' || req.user.role === 'Manager') {
  if (req.user.role === 'Manager') {
    // Always fetch from DB — avoids stale JWT branch value ('mumbai' bug)
    const managerDoc = await User.findById(req.user.id).select('branch').lean();
    effectiveBranch = managerDoc?.branch || req.user.branch;
  }
  const userFilter = { stillExist: 1 };
  if (effectiveBranch) userFilter.branch = effectiveBranch;
  if (department && department !== "all") userFilter.department = department;

  const usersMatching = await User.find(userFilter).select('_id');
  if (usersMatching.length > 0) {
    aimFilter.user = { $in: usersMatching.map(u => u._id) };
  } else {
    return res.json({ success: true, data: [] });
  }
  if (user) aimFilter.user = user;
} else {
  aimFilter.user = req.user.id;
}
```

### 2b. Date parsing — local components instead of new Date(date)
```js
// BEFORE:
// queryDate = new Date(date)
// '2026-07-28' → parsed as UTC midnight → July 27 18:30 IST → wrong day

// AFTER:
if (date) {
  const parts = date.split('T')[0].split('-');
  queryDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}
```

### 2c. totalUsers added to response
```js
// AFTER (added before res.json):
let totalUsersInScope;
if (aimFilter.user && aimFilter.user.$in) {
  totalUsersInScope = aimFilter.user.$in.length;
} else {
  const countFilter = { stillExist: 1 };
  if (effectiveBranch) countFilter.branch = effectiveBranch;
  if (department && department !== 'all') countFilter.department = department;
  totalUsersInScope = await User.countDocuments(countFilter);
}

res.json({
  success: true,
  data: enhancedAims,
  totalUsers: totalUsersInScope
});
```

---

## 3. `server/routes/auth.js` — POST `/login`

### 3a. Branch fallback fix
```js
// BEFORE:
branch: user.branch || 'mumbai',

// AFTER:
branch: user.branch || 'blackhole_mumbai',
```

---

## 4. `server/index.js`

### 4a. Dead route removed
```js
// REMOVED these two lines:
const enhancedAimsRoutes = require('./routes/enhancedAims');
app.use("/api/enhanced-aims", enhancedAimsRoutes);
```

---

## 5. `server/routes/tasks.js` — GET `/`

### 5a. submissionStatus filter in basePipeline
```js
// ADDED to basePipeline (after $match filter):
...( submissionStatus ? [
  {
    $lookup: {
      from: "tasksubmissions",
      localField: "_id",
      foreignField: "task",
      pipeline: [
        { $sort: { createdAt: -1 } },
        { $limit: 1 },
        { $project: { status: 1 } }
      ],
      as: "_sub"
    }
  },
  {
    $match: submissionStatus === "noSubmission"
      ? { "_sub": { $size: 0 } }
      : { "_sub.0.status": submissionStatus.charAt(0).toUpperCase() + submissionStatus.slice(1) }
  }
] : [] )
```

### 5b. Embedded submission in dataPipeline for Completed tasks
```js
// ADDED to dataPipeline (only when filter.status === "Completed"):
...( filter.status === "Completed" ? [
  {
    $lookup: {
      from: "tasksubmissions",
      localField: "_id",
      foreignField: "task",
      pipeline: [
        { $sort: { createdAt: -1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            pipeline: [{ $project: { name: 1, avatar: 1 } }],
            as: "userArr"
          }
        },
        { $addFields: { user: { $arrayElemAt: ["$userArr", 0] } } },
        { $project: { userArr: 0 } }
      ],
      as: "submissionArr"
    }
  },
  { $addFields: { submission: { $arrayElemAt: ["$submissionArr", 0] } } },
  { $project: { submissionArr: 0 } }
] : [] ),
```

---

## 6. `client/src/pages/CompletedTasks.jsx`

### 6a. Removed submissions state, getSubmissionForTask reads task.submission
```jsx
// REMOVED:
// const [submissions, setSubmissions] = useState([])
// separate axios.get(`${API_URL}/submissions`) fetch
// submissions.find(s => s.task === task._id)

// AFTER:
const getSubmissionForTask = useCallback((task) => task.submission ?? null, [])
```

### 6b. submissionStatus sent as query param
```jsx
// AFTER (in fetchData params):
if (subStatus && subStatus !== "all") params.set("submissionStatus", subStatus)
```

### 6c. Page resets on filter change
```jsx
// AFTER:
useEffect(() => {
  setPage(1)  // reset to page 1 whenever filters change
  fetchData(1, debouncedSearch, selectedDepartment, submissionFilter)
}, [debouncedSearch, selectedDepartment, submissionFilter])
```

### 6d. Submissions tab reads task.submission directly
```jsx
// AFTER:
tasks
  .filter((task) => task.submission)
  .map((task) => {
    const submission = task.submission
    // render row...
  })
```

---

## 7. `client/src/components/tasks/create-task-dialog.jsx`

### 7a. getTasks called with required limit param, handles paginated response
```jsx
// BEFORE:
const tasksRes = await api.tasks.getTasks()
// → 400 error, no limit param → entire Promise.all failed

// AFTER:
const tasksRes = await api.tasks.getTasks({ limit: 100, page: 1 })
const fetchedTasks = tasksRes.tasks ?? (Array.isArray(tasksRes) ? tasksRes : [])
```

### 7b. onTaskCreated callback called after successful creation
```jsx
// AFTER (in handleSubmit after successful POST):
onTaskCreated && onTaskCreated(result)
```

---

## 8. `client/src/components/tasks/task-filters.jsx`

### 8a. Controlled checkboxes
```jsx
// BEFORE (uncontrolled — no checked prop):
<Checkbox onCheckedChange={() => toggleStatus(stat)} />
<Checkbox onCheckedChange={() => toggleDepartment(dept._id)} />

// AFTER:
<Checkbox checked={status.includes(stat)} onCheckedChange={() => toggleStatus(stat)} />
<Checkbox checked={department.includes(dept._id)} onCheckedChange={() => toggleDepartment(dept._id)} />
```

### 8b. Reset Filters button + Active badge
```jsx
// ADDED:
const hasActiveFilters = status.length > 0 || department.length > 0 || priority.length > 0

// In header:
{hasActiveFilters && <Badge variant="destructive">Active</Badge>}

// Reset button (shown when hasActiveFilters):
<Button onClick={onReset}>Reset Filters</Button>
```

---

## 9. `client/src/components/tasks/tasks-list.jsx`

### 9a. Server-side pagination — single fetch per page
```jsx
// BEFORE: attempted to fetch all pages in parallel → 2435 tasks on one page

// AFTER:
const LIMIT = 100
const fetchTasks = async (page = 1) => {
  const params = { limit: LIMIT, page }
  if (filters.status) params.status = filters.status[0]
  if (filters.department) params.department = filters.department[0]
  if (filters.priority) params.priority = filters.priority[0]
  const res = await api.tasks.getTasks(params)
  setTasks(res.tasks ?? [])
  setTotal(res.total ?? 0)
  setTotalPages(res.pages ?? 1)
}
```

### 9b. Client-side search only (filters are server-side)
```jsx
// AFTER:
const filteredTasks = useMemo(() => {
  if (!searchQuery) return tasks
  return tasks.filter(t =>
    t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )
}, [tasks, searchQuery])
```

### 9c. newTask prop prepended to list
```jsx
// AFTER:
useEffect(() => {
  if (newTask) setTasks(prev => [newTask, ...prev])
}, [newTask])
```

### 9d. Socket handlers via window events
```jsx
// AFTER:
useEffect(() => {
  const onUpdated = (e) => setTasks(prev => prev.map(t => t._id === e.detail._id ? e.detail : t))
  const onDeleted = (e) => setTasks(prev => prev.filter(t => t._id !== e.detail._id))
  window.addEventListener('task-updated', onUpdated)
  window.addEventListener('task-deleted', onDeleted)
  return () => {
    window.removeEventListener('task-updated', onUpdated)
    window.removeEventListener('task-deleted', onDeleted)
  }
}, [])
```

### 9e. Summary bar
```jsx
// ADDED:
<span>Showing {start}–{end} of {total} tasks · Page {page} of {totalPages}</span>
```

### 9f. Pagination controls with ellipsis
```jsx
// ADDED: « ‹ [1] [2] … [N] › » controls
// Filters useEffect resets to page 1:
useEffect(() => { setPage(1); fetchTasks(1) }, [filters.status, filters.department, filters.priority])
```

---

## 10. `client/src/pages/Tasks.jsx`

### 10a. newTask state + onTaskCreated callback
```jsx
// ADDED:
const [newTask, setNewTask] = useState(null)

// Passed down:
<TasksHeader onTaskCreated={setNewTask} />
<TasksList newTask={newTask} />
```

---

## 11. `client/src/components/tasks/tasks-header.jsx`

### 11a. Forwards onTaskCreated to CreateTaskDialog
```jsx
// BEFORE: onTaskCreated prop not accepted or forwarded

// AFTER:
const TasksHeader = ({ onTaskCreated }) => (
  <CreateTaskDialog onTaskCreated={onTaskCreated} />
)
```

---

## 12. `client/src/lib/api.js`

### 12a. startDay endpoint corrected
```js
// BEFORE:
startDay: (userId, attendanceData) =>
  fetchAPI(`/attendance/start-day/${userId}`, {
    method: "POST",
    body: JSON.stringify(attendanceData),
  }),

// AFTER:
startDay: (userId, attendanceData) =>
  fetchAPI(`/enhanced-attendance/start-day`, {
    method: "POST",
    body: JSON.stringify(attendanceData),
  }),
```

---

## 13. `client/src/components/attendance/EnhancedStartDayDialog.jsx`

### 13a. OFFICE_RADIUS corrected to match backend
```jsx
// BEFORE:
const OFFICE_RADIUS = 2000; // meters — frontend showed "At Office" when user was actually too far

// AFTER:
const OFFICE_RADIUS = 100; // meters — matches backend OFFICE_RADIUS default
```
