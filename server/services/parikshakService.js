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
            current_task_id: task._id.toString(),
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
                    timeout: 30000 // 30s timeout per request
                };
                if (PARIKSHAK_TOKEN) {
                    config.headers['Authorization'] = `Bearer ${PARIKSHAK_TOKEN}`;
                }
                
                const startTime = Date.now();
                const res = await axios.post(PARIKSHAK_URL, payload, config);
                const runtimeMs = Date.now() - startTime;
                console.log(`[PARIKSHAK] API Call succeeded in ${runtimeMs}ms on attempt ${attempt === 0 ? 1 : attempt}`);
                
                response = res.data;
                break; // Success, exit retry loop
            } catch (err) {
                attempt++;
                console.error(`[PARIKSHAK] API Call failed on attempt ${attempt}:`, err.message);
                if (attempt <= 3) {
                    const delay = delays[attempt - 1];
                    console.log(`[PARIKSHAK] Retrying in ${delay / 1000}s...`);
                    await sleep(delay);
                }
            }
        }

        // 4. Handle failure to connect
        if (!response) {
            console.error(`[PARIKSHAK] Exhausted all retries for submission ${submissionId}. Marking as System Error.`);
            submission.status = "Rejected";
            submission.feedback = "System Error: Parikshak review service is currently unavailable. Please contact an administrator.";
            await submission.save();
            return;
        }

        // 5. Process Review Response
        console.log(`[PARIKSHAK] Review Response: Status=${response.status}, Score=${response.score}`);
        
        let finalStatus = "Rejected"; // Default to rejected
        let finalFeedback = response.review || "";

        if (response.status === "PASS") {
            finalStatus = "Approved";
        } else if (response.status === "PARTIAL") {
            finalStatus = "Rejected";
            finalFeedback = `PARTIAL SUCCESS (Score: ${response.score}) - You are close, please fix the following and resubmit:\n\n${response.review}`;
        } else {
            // FAIL
            finalStatus = "Rejected";
            finalFeedback = `FAILED (Score: ${response.score}) - Please review the feedback and resubmit:\n\n${response.review}`;
        }

        // Extract structured fields
        let doneWell = "Good effort on submitting the task.";
        let missingWork = "Review the feedback for details.";
        let recommendations = "Please check the AI review guidelines.";
        let readiness = response.status === "PASS" ? "Production Ready" : "Requires Revisions";
        
        if (response.review_details) {
            doneWell = response.review_details.done_well || doneWell;
            missingWork = response.review_details.missing_work || missingWork;
            recommendations = response.review_details.recommendations || recommendations;
            readiness = response.review_details.readiness || readiness;
        } else if (response.review) {
            // Basic heuristic fallback if they only send a string
            doneWell = response.review;
            missingWork = finalStatus === "Rejected" ? "Please review the full feedback text." : "None";
            recommendations = "See detailed feedback for full context.";
        }

        // Update submission
        submission.status = finalStatus;
        submission.feedback = finalFeedback;
        submission.aiReviewDetails = {
            score: response.score,
            result: response.result || (finalStatus === "Approved" ? "PASS" : "FAIL"),
            doneWell,
            missingWork,
            recommendations,
            readiness
        };
        await submission.save();

        // Phase 2: MasterDB Integration - Candidate Execution History
        try {
            const TaskEvaluation = require('../models/TaskEvaluation');
            const User = require('../models/User');
            let adminUser = await User.findOne({ role: { $in: ['Admin', 'Manager'] } });
            let evaluatorId = adminUser ? adminUser._id : user._id;
            
            await TaskEvaluation.create({
                task: task._id,
                submission: submission._id,
                evaluatedBy: evaluatorId,
                projectName: "Parikshak Automated Review",
                moduleName: task.title.substring(0, 50),
                submittedBy: user._id,
                testingLevel: "Task",
                testConductedBy: "PARIKSHAK_AI",
                functionalTesting: {
                    result: response.result === "PARTIAL" ? "PARTIAL" : (response.result === "PASS" || finalStatus === "Approved" ? "PASS" : "FAIL"),
                    notes: doneWell
                },
                finalVerdict: finalStatus === "Approved" ? "APPROVED" : "REJECTED",
                branch: task.branch
            });
            console.log(`[PARIKSHAK] Phase 2: MasterDB TaskEvaluation record created for ${task._id}`);
        } catch (evalErr) {
            console.error(`[PARIKSHAK] Failed to create TaskEvaluation record:`, evalErr.message);
        }

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
                
                const nextTaskData = response.next_task || (response.review_details && response.review_details.next_task) || {};
                
                const newTask = new Task({
                    title: nextTaskData.title || `Follow-up: ${task.title}`,
                    description: nextTaskData.description || `Automated next task based on the completion of ${task.title}. \n\nParikshak Review:\n${doneWell}\n${recommendations}`,
                    status: "Pending",
                    priority: nextTaskData.priority || task.priority,
                    department: task.department,
                    assignee: task.assignee, // Assign same candidate
                    dueDate: nextTaskData.dueDate ? new Date(nextTaskData.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
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

module.exports = {
    invokeParikshak
};
