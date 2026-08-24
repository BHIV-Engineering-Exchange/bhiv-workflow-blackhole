const axios = require('axios');
const TaskSubmission = require('../models/TaskSubmission');
const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { emitTaskCompletedEvent, emitTaskFailedEvent } = require('./taskExecutionBridge');

const PARIKSHAK_URL = process.env.PARIKSHAK_URL || 'http://localhost:8000/parikshak/review';
const PARIKSHAK_TOKEN = process.env.PARIKSHAK_TOKEN || '';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const invokeParikshak = async (submissionId, traceId, io) => {
    try {
        console.log(`[PARIKSHAK] Starting review for submission ${submissionId}, trace_id: ${traceId}`);
        
        // 1. Fetch data
        const submission = await TaskSubmission.findById(submissionId).populate('task').populate('user');
        if (!submission || !submission.task || !submission.user) {
            console.error(`[PARIKSHAK] Submission ${submissionId} not found or incomplete data.`);
            return;
        }

        const task = submission.task;
        const user = submission.user;

        // 2. Build payload
        const payload = {
            title: task.title || 'Untitled Task',
            description: task.description || submission.notes || 'No description provided',
            submitted_by: user.name || user._id.toString(),
            repo_url: submission.githubLink || '',
            current_task_id: task.task_id || (String(task._id).startsWith("task") ? String(task._id) : `task-${task._id}`),
            trace_id: traceId
        };

        // 3. Make API call with exponential backoff (3 retries)
        let response = null;
        let attempt = 0;
        const delays = [5000, 15000, 30000]; // 5s, 15s, 30s
        
        while (attempt <= 3) {
            try {
                const config = {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000, // 30s timeout per request
                    validateStatus: (status) => status < 600
                };
                if (PARIKSHAK_TOKEN) {
                    config.headers['Authorization'] = `Bearer ${PARIKSHAK_TOKEN}`;
                }
                
                const startTime = Date.now();
                const targetUrl = PARIKSHAK_URL.endsWith("/parikshak/review")
                    ? PARIKSHAK_URL
                    : `${PARIKSHAK_URL.replace(/\/$/, "")}/parikshak/review`;

                const res = await axios.post(targetUrl, payload, config);
                const runtimeMs = Date.now() - startTime;
                console.log(`[PARIKSHAK] API Call completed with status ${res.status} in ${runtimeMs}ms on attempt ${attempt === 0 ? 1 : attempt}`);
                
                response = res.data;
                break; // Success, exit retry loop
            } catch (err) {
                attempt++;
                console.error(`[PARIKSHAK] API Call network error on attempt ${attempt}:`, err.message);
                if (err.response && err.response.data) {
                    response = err.response.data;
                    break;
                }
                if (attempt <= 3) {
                    const delay = delays[attempt - 1];
                    console.log(`[PARIKSHAK] Retrying in ${delay / 1000}s...`);
                    await sleep(delay);
                }
            }
        }

        // 4. Handle failure to connect -> Keep in Pending status for manual review
        if (!response) {
            console.warn(`[PARIKSHAK] Exhausted all retries for submission ${submissionId}. Queuing for manual review.`);
            submission.status = "Pending";
            submission.feedback = "Parikshak AI review service is currently offline. Your submission is queued in Pending status for manual review by an admin.";
            await submission.save();
            return;
        }

        // 5. Process Review Response
        console.log(`[PARIKSHAK] Review Response: Status=${response.status}, Score=${response.score}`);
        
        const responseStatus = String(response.status || response.result || "").toUpperCase();
        const scoreVal = (response.score !== undefined && response.score !== null)
            ? response.score
            : ((response.readiness_percent !== undefined && response.readiness_percent !== null) ? response.readiness_percent : 0);

        let reviewText = response.review || response.detail || response.reason || "";
        if (!reviewText && Array.isArray(response.failure_reasons) && response.failure_reasons.length > 0) {
            reviewText = response.failure_reasons.join('\n');
        }
        if (!reviewText && Array.isArray(response.improvement_hints) && response.improvement_hints.length > 0) {
            reviewText = response.improvement_hints.join('\n');
        }
        if (!reviewText) {
            reviewText = "Submission did not pass automated AI evaluation criteria.";
        }

        let finalStatus = "Rejected"; // Default to rejected
        let finalFeedback = reviewText;

        if (responseStatus === "PASS" || responseStatus === "APPROVED" || responseStatus === "SUCCESS") {
            finalStatus = "Approved";
        } else if (responseStatus === "PARTIAL" || responseStatus === "BORDERLINE") {
            finalStatus = "Rejected";
            finalFeedback = `PARTIAL SUCCESS (Score: ${scoreVal}) - You are close, please fix the following and resubmit:\n\n${reviewText}`;
        } else {
            // FAIL
            finalStatus = "Rejected";
            finalFeedback = `FAILED (Score: ${scoreVal}) - Please review the feedback and resubmit:\n\n${reviewText}`;
        }

        // Extract structured fields
        let doneWell = "Good effort on submitting the task.";
        let missingWork = "Review the feedback for details.";
        let recommendations = "Please check the AI review guidelines.";
        let readiness = (responseStatus === "PASS" || responseStatus === "APPROVED") ? "Production Ready" : "Requires Revisions";
        
        if (response.review_details) {
            doneWell = response.review_details.done_well || doneWell;
            missingWork = response.review_details.missing_work || missingWork;
            recommendations = response.review_details.recommendations || recommendations;
            readiness = response.review_details.readiness || readiness;
        } else {
            doneWell = (responseStatus === "PASS" || responseStatus === "APPROVED")
                ? (reviewText || "Clean codebase integration matching expected requirements.")
                : "Submission passed initial automated structure intake.";
            missingWork = (responseStatus === "PASS" || responseStatus === "APPROVED")
                ? "None"
                : (reviewText || "Review feedback details to fix failed criteria.");
            recommendations = (Array.isArray(response.improvement_hints) && response.improvement_hints.length > 0)
                ? response.improvement_hints.join(' ')
                : (finalStatus === "Approved" ? "Proceed to recommended next task." : "Follow engineering recommendations and resubmit.");
        }

        const passFailStatus = response.result || response.status || (finalStatus === "Approved" ? "PASS" : (responseStatus === "PARTIAL" ? "PARTIAL" : "FAIL"));
        const nextTaskName = response.next_task || (response.next_task_proposal && response.next_task_proposal.title) || "";

        // Update submission
        submission.status = finalStatus;
        submission.feedback = finalFeedback;
        submission.aiReviewDetails = {
            score: scoreVal,
            result: passFailStatus,
            doneWell,
            missingWork,
            recommendations,
            readiness
        };
        submission.parikshakReview = {
            status: passFailStatus,
            score: scoreVal,
            review: finalFeedback,
            nextTask: nextTaskName,
            reviewedAt: new Date()
        };
        await submission.save();

        // Phase 2: MasterDB Integration - Candidate Execution History (Disabled per user preference)
        // TaskEvaluation records will not be automatically generated on submission review.

        // Update task status and emit events
        let execContext;
        try {
            if (finalStatus === "Approved") {
                execContext = await emitTaskCompletedEvent(submission, traceId, task.branch);
                console.log(`[TRACE_EMITTED] Task completed (Automated) - trace_id=${execContext?.traceId}`);
                
                // Phase 2: KARMA Runtime Integration
                try {
                    const karmaClient = require('./karmaClient');
                    await karmaClient.signalTaskCompleted(user._id.toString(), traceId);
                    console.log(`[KARMA] signalTaskCompleted emitted for ${user._id}`);
                } catch (karmaErr) {
                    console.warn(`[KARMA] Failed to emit signalTaskCompleted:`, karmaErr.message);
                }
                
                if (task.status !== "Completed") {
                    task.status = "Completed";
                    task.progress = 100;
                    await task.save();
                }

                // Phase 3: Next Task Runtime
                console.log(`[PARIKSHAK] Phase 3: Creating next task for assignee ${task.assignee}`);
                
                let nextTaskTitle = "";
                let nextTaskDescription = "";

                if (typeof response.next_task === 'object' && response.next_task !== null) {
                    nextTaskTitle = response.next_task.title || response.next_task.name || response.next_task.objective || "";
                    nextTaskDescription = response.next_task.description || response.next_task.objective || "";
                } else if (typeof response.next_task === 'string' && response.next_task.trim()) {
                    const rawNext = response.next_task.trim();
                    if (rawNext.toLowerCase().includes("test task") || rawNext.toLowerCase().startsWith("task-next")) {
                        nextTaskTitle = `Phase 2: ${task.title}`;
                    } else {
                        nextTaskTitle = rawNext;
                    }
                }

                if (!nextTaskTitle || nextTaskTitle.toLowerCase().includes("test task")) {
                    nextTaskTitle = `Advanced Integration: ${task.title}`;
                }

                if (!nextTaskDescription) {
                    nextTaskDescription = `Next production phase following successful evaluation of '${task.title}'.\n\nAutomated AI Review Summary:\n${doneWell}\n\nRecommended Guidelines:\n${recommendations}`;
                }
                
                const newTask = new Task({
                    title: nextTaskTitle,
                    description: nextTaskDescription,
                    status: "Pending",
                    priority: task.priority || "Medium",
                    department: task.department,
                    assignee: task.assignee, // Assign same candidate
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
                    dependencies: task.dependencies, // Preserve dependencies
                    branch: task.branch, // Preserve product/tenant
                    progress: 0,
                });
                
                await newTask.save();
                console.log(`[PHASE 3] Created new assigned task: ${newTask._id} with canonical task packet`);

                // Emit task assigned event for the new task
                const { emitTaskAssignedEvent } = require('./taskExecutionBridge');
                await emitTaskAssignedEvent(newTask, traceId, newTask.branch);

                // Notify candidate about new task
                await Notification.create({
                    recipient: newTask.assignee,
                    type: "task_assigned",
                    title: `New Automatically Assigned Task`,
                    message: `A follow-up task "${newTask.title}" has been automatically assigned to you.`,
                    task: newTask._id
                });
                // End Phase 3

            } else {
                execContext = await emitTaskFailedEvent(
                    submission, 
                    finalFeedback || "submission_rejected_by_ai", 
                    traceId, 
                    task.branch
                );
                console.log(`[TRACE_EMITTED] Task failed (Automated) - trace_id=${execContext?.traceId}`);
                
                // If the task was previously "Completed", we might want to move it back to "In Progress" since the automated review failed it.
                if (task.status === "Completed") {
                    task.status = "In Progress";
                    await task.save();
                }
            }
        } catch (execErr) {
            console.error("[TRACE_FAILURE] Failed to emit automated review event:", execErr);
        }

        // Emit Socket Event
        if (io) {
            io.emit("submission-reviewed", {
                submission,
                trace_id: execContext?.traceId,
                automated: true
            });
        }

        // Notify the submitter
        await Notification.create({
            recipient: user._id,
            type: "submission_reviewed",
            title: `Automated Review: ${finalStatus}`,
            message: `Your submission for task '${task.title}' has been ${finalStatus.toLowerCase()} by Parikshak.`,
            task: task._id
        });
        
        console.log(`[PARIKSHAK] Finished automated review workflow for submission ${submissionId}`);

    } catch (error) {
        console.error(`[PARIKSHAK] Critical error in review workflow for submission ${submissionId}:`, error);
    }
};

const triggerReview = async ({
    submission,
    task,
    userName = "Candidate",
    io = null,
    Notification: NotificationModel = Notification,
    TaskSubmission: TaskSubmissionModel = TaskSubmission
} = {}) => {
    try {
        if (!submission || !task) return;
        
        const subId = typeof submission === 'string' ? submission : (submission._id || "sub-default");
        const taskId = typeof task === 'string' ? task : (task._id || "task-default");
        const userId = typeof submission === 'object' ? (submission.user || "user-001") : "user-001";
        
        const payload = {
            title: task.title || 'Untitled Task',
            description: task.description || submission.notes || 'No description provided',
            submitted_by: userName || 'Candidate',
            repo_url: submission.githubLink || '',
            current_task_id: task.task_id || (String(taskId).startsWith("task") ? String(taskId) : `task-${taskId}`),
            trace_id: submission.trace_id || `trace-bhiv-${subId}`
        };

        const config = {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        };
        if (PARIKSHAK_TOKEN) {
            config.headers['Authorization'] = `Bearer ${PARIKSHAK_TOKEN}`;
        }
        
        const targetUrl = PARIKSHAK_URL.endsWith("/parikshak/review")
            ? PARIKSHAK_URL
            : `${PARIKSHAK_URL.replace(/\/$/, "")}/parikshak/review`;

        const res = await axios.post(targetUrl, payload, config);
        const response = res.data;

        const responseStatus = String(response.status || response.result || "").toUpperCase();
        const scoreVal = (response.score !== undefined && response.score !== null)
            ? response.score
            : ((response.readiness_percent !== undefined && response.readiness_percent !== null) ? response.readiness_percent : 0);

        let reviewText = response.review || response.detail || response.reason || "";
        if (!reviewText && Array.isArray(response.failure_reasons) && response.failure_reasons.length > 0) {
            reviewText = response.failure_reasons.join('\n');
        }
        if (!reviewText) {
            reviewText = "Submission did not pass automated AI evaluation criteria.";
        }

        let finalStatus = "Rejected";
        if (responseStatus === "PASS" || responseStatus === "APPROVED" || responseStatus === "SUCCESS") {
            finalStatus = "Approved";
        } else if (responseStatus === "PARTIAL" || responseStatus === "BORDERLINE") {
            finalStatus = "Pending";
        } else {
            finalStatus = "Rejected";
        }

        if (TaskSubmissionModel && TaskSubmissionModel.findByIdAndUpdate) {
            await TaskSubmissionModel.findByIdAndUpdate(subId, {
                $set: {
                    status: finalStatus,
                    feedback: reviewText,
                    parikshakReview: {
                        status: response.status || finalStatus,
                        score: scoreVal,
                        review: reviewText,
                        nextTask: response.next_task || "",
                        reviewedAt: new Date()
                    },
                    aiReviewDetails: {
                        score: scoreVal,
                        result: response.status || finalStatus,
                        doneWell: reviewText,
                        missingWork: finalStatus === "Approved" ? "None" : reviewText,
                        recommendations: "Review AI guidelines and update code",
                        readiness: finalStatus === "Approved" ? "Production Ready" : "Requires Revisions"
                    }
                }
            });
        }

        if (NotificationModel && NotificationModel.create) {
            try {
                await NotificationModel.create({
                    recipient: userId,
                    type: "submission_reviewed",
                    title: `AI Review: ${response.status || finalStatus} (${scoreVal}/100)`,
                    message: reviewText,
                    task: taskId
                });
            } catch (err) {
                console.warn("[PARIKSHAK] Notification creation failed:", err.message);
            }
        }

        if (io && io.emit) {
            io.emit("parikshak:review-complete", {
                submissionId: subId,
                taskId: taskId,
                userId: userId,
                status: response.status || finalStatus,
                score: scoreVal,
                nextTask: response.next_task || ""
            });
        }
    } catch (err) {
        console.error("[PARIKSHAK] triggerReview failed:", err.message);
    }
};

module.exports = {
    invokeParikshak,
    triggerReview
};
