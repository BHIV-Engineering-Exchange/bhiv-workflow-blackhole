# Comprehensive Audit: Employee Monitoring System (Beyond Keystrokes & Mouse Activity)
**Repository**: `bhiv-workflow-blackhole`  
**Focus**: Evaluation of Monitoring Documentation, Existing Codebase Mechanisms, Task/Aim Alignment, and Productivity Scoring Logic  
**Date**: October 2026

---

## 1. Executive Summary & Audit Verdict

Your supervisor's assessment is **100% technically and architecturally accurate**:

1. **Current Code Over-Relies on Keystrokes & Mouse**: In the current implementation ([EmployeeActivity.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/EmployeeActivity.js#L99-L122) and [ems_signals.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/ems_signals.js#L530-L562)), "productivity score" is calculated almost exclusively from typing rate, mouse movement, and idle seconds. If typing or mouse input drops for 30 seconds, productivity collapses to **0%**.
2. **Docs Intended a Multi-Parameter System**: The repository documentation (notably [docs/AI_SCORING.md](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/docs/AI_SCORING.md), [ENHANCED_ATTENDANCE_SYSTEM.md](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/Complete-Infiverse-main/ENHANCED_ATTENDANCE_SYSTEM.md), and [HANDOVER_SHEET.md](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/Complete-Infiverse-main/HANDOVER_SHEET.md)) specifies that keyboard and mouse input are **activity and presence markers** (determining idle vs. active states), whereas actual productivity was intended to be driven by:
   - **Task assignment & daily aim setting** at the start of the day.
   - **Deliverable achievement & MVP delivery** at day's end.
   - **Deadline adherence** (`dueDate` matching submission time).
   - **Task relevance** (via OCR and application categorization).
   - **Review evaluations** (via Parikshak AI review and admin quality checks).
3. **The Role Disparity Problem**: For teams like **Physical Engineering** (CAD modeling, hardware testing, blueprint inspection) and modern **Vibe Coders / Prompt Engineers** (high-level LLM prompt design, code synthesis, testing, and review), high typing speeds (WPM) do not correlate with high productivity. Penalizing them for low keystrokes creates a severe false negative.

---

## 2. Inventory of Existing Code & Docs (Beyond Keystrokes & Mouse)

Below is the complete audit of all non-keystroke/non-mouse monitoring, task tracking, and evaluation infrastructure already built into the codebase:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│              EXISTING EMPLOYEE MONITORING & PERFORMANCE CAPABILITIES             │
├───────────────────────┬──────────────────────────┬──────────────────────────────┤
│ 1. DAILY AIM & DAY    │ 2. TASK LIFECYCLE &      │ 3. WORK CONTENT &            │
│    START/END          │    DEADLINES             │    BEHAVIORAL SIGNALS        │
├───────────────────────┼──────────────────────────┼──────────────────────────────┤
│ • Aim.js              │ • Task.js                │ • ocrAnalysisService.js      │
│ • enhancedAims.js     │ • TaskSubmission.js      │ • WebsiteWhitelist.js        │
│ • Attendance.js       │ • TaskEvaluation.js      │ • intelligentScreenCapture.js│
│ • WorkSession.js      │ • tasks.js & overdue     │ • signal_spec.md (8 signals) │
│ • DailyAttendance.js  │ • parikshakService.js    │ • MonitoringAlert.js         │
└───────────────────────┴──────────────────────────┴──────────────────────────────┘
```

### A. Daily Aim & Day-Start/End Tracking
* **Models**: [Aim.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/Aim.js), [Attendance.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/Attendance.js), [DailyAttendance.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/DailyAttendance.js), [WorkSession.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/WorkSession.js)
* **Routes**: [enhancedAims.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/routes/enhancedAims.js), [aims_universal.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/routes/aims_universal.js), [attendance.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/routes/attendance.js)
* **What is present**:
  1. **Aim Setting on Day Start**: When an employee starts their day, they enter daily aims (`aims`).
  2. **Aim Completion Status**: [Aim.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/Aim.js#L24-L40) has `completionStatus: ['Pending', 'Completed', 'MVP Achieved']`.
  3. **Mandatory Completion Comments**: If marked completed or MVP achieved, `completionComment` is required.
  4. **Progress & Blockers**: Fields for `progressPercentage` (0–100%), `achievements`, `blockers`, and `progressNotes`.
  5. **Prerequisite Check on End Day**: [ENHANCED_ATTENDANCE_SYSTEM.md](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/Complete-Infiverse-main/ENHANCED_ATTENDANCE_SYSTEM.md#L83-L97) specifies that day completion requires daily aim achievement and progress submission.

### B. Task Assignment, Deadlines & Completion Tracking
* **Models**: [Task.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/Task.js), [TaskSubmission.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/TaskSubmission.js), [TaskEvaluation.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/TaskEvaluation.js)
* **Routes**: [tasks.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/routes/tasks.js), [submission.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/routes/submission.js)
* **What is present**:
  1. **Task Model Fields**: `title`, `description`, `assignee`, `department`, `priority` (`Low/Medium/High`), `status` (`Pending/In Progress/Completed`), `dueDate` (hard deadline), `progress` (0–100%), `dependencies`.
  2. **Overdue Task Tracking**: [tasks.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/routes/tasks.js#L140-L150) has a dedicated `/api/tasks/overdue` endpoint checking `dueDate < now && status !== "Completed"`.
  3. **Submission Verification & Deliverables**: [TaskSubmission.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/TaskSubmission.js#L75-L98) tracks `githubLink`, `documentLink`, `notes`, `fileType`, `resubmittedAt`, and `status` (`Pending/Approved/Rejected`).
  4. **Formal Quality Evaluation**: [TaskEvaluation.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/TaskEvaluation.js#L44-L125) checks 9 dimensions: Deliverables Received, Functional Testing (PASS/FAIL), Code Quality, Data Handling, Integration Readiness, Security Checks, Performance Checks, Documentation Quality, and Testing Evidence.
  5. **Parikshak Automated AI Review**: [parikshakService.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/parikshakService.js) generates scores on deliverables, missing work, and readiness.

### C. Screen OCR & Task Relevance AI
* **Service**: [ocrAnalysisService.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/ocrAnalysisService.js)
* **Specification**: [docs/AI_SCORING.md](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/docs/AI_SCORING.md#L34)
* **What is present**:
  1. **Tesseract OCR**: Extracts text from active screens to understand what the user is reading or working on.
  2. **Task Relevance Scoring**: Compares the on-screen text directly against the user's assigned task using UniGuru/Groq AI ([ocrAnalysisService.js lines 93–149](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/ocrAnalysisService.js#L93-L149)).
  3. **Output Metrics**: Returns `isWorkRelated`, `taskRelevance` (0–100%), `activityType` (`coding`, `research`, `communication`, `entertainment`, etc.), and `productivityLevel` (`high`, `medium`, `low`).

### D. Application, URL & Behavioral Signals (Beyond Typing/Mouse)
* **Service**: [ems_signals.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/ems_signals.js), [websiteMonitor.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/websiteMonitor.js)
* **Specification**: [server/services/signal_spec.md](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/signal_spec.md)
* **What is present**:
  1. **Window Focus (`window_focus`)**: Detects if employee's working window is focused or running in background.
  2. **Browser Visibility (`browser_hidden`)**: Detects when work windows are minimized.
  3. **Task Tab Active (`task_tab_active`)**: Checks if active tab/window matches whitelist (GitHub, StackOverflow, Figma, Notion, Slack, internal apps) vs blacklist (Netflix, social media, entertainment).
  4. **Context Switching (`app_switch`)**: Measures distraction by tracking excessive application switching (>20/hr).
  5. **Content Interaction (`scroll_depth`)**: Monitors document reading and code review via scroll velocity and depth.

---

## 3. Root-Cause Analysis: Why the Current Code Has Gaps

Despite the rich infrastructure above, the current calculation of productivity suffers from 4 structural flaws:

### Flaw 1: Hardcoded Reliance on Typing Rate in `EmployeeActivity.js`
In [EmployeeActivity.js line 105](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/EmployeeActivity.js#L105):
```javascript
// Current formula:
if ((keys === 0 && mouse < 10) || idleSec >= 30) {
  this.productivity_score = 0;
  return 0;
}
this.productivity_score = Math.round(
  (keystrokeScore * 0.35) +
  (mouseScore * 0.35) +
  (activeRatioScore * 0.3)
);
```
* **Impact**: Productivity is 70% keystrokes and mouse movement. If an engineer is thinking, formulating prompts, analyzing schematics, or reviewing architecture for just 30 seconds without moving the mouse, the snapshot score is **0%**.

### Flaw 2: The Two Subsystems Live in Isolated Silos
* **Silo A (Monitoring)**: [ems_signals.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/ems_signals.js), [agentActivity.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/routes/agentActivity.js), [monitoring.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/routes/monitoring.js), and [reportGenerator.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/reportGenerator.js).
* **Silo B (Workflow Delivery)**: [Aim.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/Aim.js), [Task.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/Task.js), [TaskSubmission.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/TaskSubmission.js), and [TaskEvaluation.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/TaskEvaluation.js).
* **Impact**: Even if an employee delivers 100% of their daily aims, submits all tasks on time, and gets approved by Parikshak, **none of these achievements feed into `EmployeeActivity.productivity_score` or the daily productivity score on the monitoring dashboard!**

### Flaw 3: Critical Schema Bug in `ocrAnalysisService.js`
In [ocrAnalysisService.js lines 269–272](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/ocrAnalysisService.js#L269-L272):
```javascript
const currentTask = await Task.findOne({
  assignedTo: employeeId,                  // ❌ BUG: Task.js field is 'assignee'
  status: { $in: ['pending', 'in-progress'] } // ❌ BUG: Task.js enum is ['Pending', 'In Progress']
});
```
* **Impact**: Because the field in [Task.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/Task.js#L93) is named `assignee` (not `assignedTo`) and enum values are PascalCase (`Pending`, `In Progress`), this database query **always returns `null`**. As a result, the AI is told "No active task assigned," breaking automated task-relevance verification!

### Flaw 4: Typing Speed Baseline Built on Secretarial Standards
In [keystrokeAnalytics.js line 336](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/keystrokeAnalytics.js#L336):
```javascript
const speedFactor = Math.min(analysis.keystroke_data.typing_speed_wpm / 40, 1); // 40 WPM baseline
```
* **Impact**: A standard 40 WPM continuous typing benchmark assumes data entry or document transcription. For engineers working with CAD tools or AI prompt synthesis, bursts of 5–10 words followed by 5 minutes of verification are normal. This benchmark directly penalizes technical work.

---

## 4. Nuances: Physical Engineering & Vibe Coding vs Typing-Heavy Roles

| Aspect | Typing-Heavy Role (Content/Support) | Physical Engineering (Hardware/CAD) | Modern "Vibe Coding" / AI Prompting |
| :--- | :--- | :--- | :--- |
| **Typing Pattern** | Continuous, high WPM (40–70 WPM) | Sporadic, mostly numeric inputs, hotkeys | Short prompt bursts (5–15 words), waiting on AI generation |
| **Mouse Interaction** | Minimal, mostly text navigation | Heavy 3D view rotation, panning, zooming | Browser inspecting, reviewing diffs, clicking Run/Test |
| **Primary Output** | Word count, tickets answered | Schematics, 3D models, test reports | High-quality features, clean PRs, passing tests |
| **Idle Time Meaning** | Often actual downtime | Inspecting physical hardware or simulation runs | Reading LLM outputs, debugging, architectural thought |
| **Fair Productivity Metric** | Input volume & ticket turnaround | Aim delivery, design milestones, test validation | Aim achievement, PR approval, deadline punctuality |

---

## 5. The Fine-Tuned Productivity Framework (Recommended Logic)

To implement what your supervisor described, the productivity calculation should be split into **Activity/Presence Markers** (Base Activity) and **Delivery/Achievement Metrics** (Core Productivity).

### Multi-Parameter Scoring Equation
$$\text{Productivity Score (0--100)} = \underbrace{\text{Delivery Score (60\%)}}_{\text{Aims, Tasks, Deadlines, Quality}} + \underbrace{\text{Presence \& Activity Score (40\%)}}_{\text{Time active, tool relevance, presence proof}}$$

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   UNIFIED MULTI-PARAMETER PRODUCTIVITY MODEL                     │
├─────────────────────────────────────────────────┬────────────────────────────────┤
│ 1. DELIVERY SCORE (60%)                         │ 2. PRESENCE & RELEVANCE (40%)  │
├─────────────────────────────────────────────────┼────────────────────────────────┤
│ A. Daily Aim Delivery (25%)                     │ A. Active Shift Ratio (15%)    │
│    • Set Aim + Delivered (Completed/MVP): 25 pts│    • Active computer hours vs  │
│    • In Progress / Partial notes: 15 pts        │      target shift hours        │
│    • Aim Not Achieved / Empty: 0 pts            │                                │
│                                                 │ B. Application/Tool Relevance  │
│ B. Task Progress & Deadlines (20%)              │    (15%)                       │
│    • Task completed before deadline: 20 pts     │    • Work-related apps & tabs  │
│    • On-track progress (no overdue): 15 pts     │      (IDEs, CAD, Docs, GitHub) │
│    • Overdue tasks pending: -10 pts deduction   │                                │
│                                                 │ C. Activity Marker (10%)       │
│ C. Submission & Deliverable Quality (15%)       │    • Presence proof (mouse/key │
│    • Task approved by Admin/Parikshak: 15 pts   │      transitions, scroll)      │
│    • Resubmitted / Under review: 10 pts         │    • Serves as anti-idle proof │
│    • Revision requested: 5 pts                  │    • Role-adjusted threshold   │
└─────────────────────────────────────────────────┴────────────────────────────────┘
```

### Detailed Parameter Breakdown

1. **Daily Aim Achievement (25%)**:
   - Check [Aim.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/Aim.js) for `user` on `date`.
   - If `completionStatus === 'Completed'` $\rightarrow$ **25 points**.
   - If `completionStatus === 'MVP Achieved'` $\rightarrow$ **20 points**.
   - If `progressPercentage >= 75%` with completion comment $\rightarrow$ **18 points**.
   - If `completionStatus === 'Pending'` and no progress notes $\rightarrow$ **0 points**.

2. **Task Progress & Deadline Adherence (20%)**:
   - Check [Task.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/Task.js) for tasks where `assignee === employeeId`.
   - Tasks completed on or before `dueDate` $\rightarrow$ **Full 20 points**.
   - If any assigned task has `dueDate < today && status !== 'Completed'` $\rightarrow$ **Deduct 5 to 10 points**.

3. **Deliverable Quality & Review Outcome (15%)**:
   - Check [TaskSubmission.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/TaskSubmission.js).
   - If submission `status === 'Approved'` $\rightarrow$ **15 points**.
   - If Parikshak review score $\ge 70\%$ $\rightarrow$ **Bonus / Full credit**.

4. **Tool & Work Relevance (15%)**:
   - Time spent on Whitelisted domains (`github.com`, `figma.com`, IDEs, CAD tools, documentation) vs non-work apps ([WebsiteWhitelist.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/WebsiteWhitelist.js)).

5. **Presence & Anti-Idle Marker (10% + 15% Active Time)**:
   - Keystrokes and mouse movement are used **only** to establish that the user is not idle (anti-ghosting).
   - Once baseline presence is established (e.g. 5+ inputs in a 5-minute block or active CAD window), full presence credit is awarded. Excessively high typing is **not** rewarded over intellectual thinking.

---

## 6. Actionable Implementation Plan

To tune the system to match your supervisor's requirements:

1. **Step 1: Fix Schema Bug in OCR Task Lookup**
   - In [ocrAnalysisService.js lines 269–272](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/ocrAnalysisService.js#L269-L272), change `assignedTo` to `assignee` and normalize status to `['Pending', 'In Progress']`.
2. **Step 2: Bridge Aim & Task Data into Daily Monitoring**
   - In [monitoring.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/routes/monitoring.js#L1886) (`/daily-summary`), fetch today's [Aim.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/Aim.js) and active [Task.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/Task.js) records for each employee.
3. **Step 3: Update `calculateProductivityScore` Method**
   - Update [EmployeeActivity.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/EmployeeActivity.js) and [reportGenerator.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/services/reportGenerator.js) to adopt the multi-parameter formula where typing/mouse acts as an additive presence marker rather than the core productivity score.
4. **Step 4: Add Role/Department Profile Support**
   - In [Department.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/Department.js) or [User.js](file:///d:/Internship%20Task/Niyantran-Workflow-BHIV/bhiv-workflow-blackhole/server/models/User.js), allow marking departments as `Physical Engineering`, `AI / Vibe Coding`, or `Data Operations` to automatically calibrate baseline activity expectations.
