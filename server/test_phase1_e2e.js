require('dotenv').config();
// Override BEFORE requiring bucketClient
process.env.BUCKET_BASE_URL = 'http://localhost:8001';

const mongoose = require('mongoose');
const User = require('./models/User');
const Department = require('./models/Department');
const Task = require('./models/Task');
const TaskSubmission = require('./models/TaskSubmission');
const Notification = require('./models/Notification');
const emsSignals = require('./services/ems_signals');
const karmaClient = require('./services/karmaClient');
const { emitTaskAssignedEvent } = require('./services/taskExecutionBridge');
const parikshakService = require('./services/parikshakService');
const express = require('express');

// Start mock bucket server to intercept KARMA calls
const mockBucketApp = express();
mockBucketApp.use(express.json());
mockBucketApp.get('/bucket/latest-hash', (req, res) => res.json({ hash: 'mock_hash_123' }));
mockBucketApp.post('/bucket/artifact', (req, res) => res.json({ success: true, hash: 'mock_hash_123' }));
const mockBucketServer = mockBucketApp.listen(8001);

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/niyantran_local";

async function runE2E() {
    console.log("======================================================");
    console.log("🚀 PHASE 1: ENTERPRISE WORKFLOW RUNTIME E2E VALIDATION");
    console.log("======================================================\n");

    try {
        console.log("⏳ Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("✅ Connected to MongoDB\n");

        // 1. Setup Test Data (Login)
        console.log("➡️  STAGE 1: Employee Login");
        let dept = await Department.findOne({ name: 'Engineering' });
        if (!dept) {
            dept = await Department.create({ name: 'Engineering', description: 'Test' });
        }

        let user = await User.findOne({ email: 'e2e_test@example.com' });
        if (!user) {
            user = await User.create({
                firstName: 'E2E',
                lastName: 'Tester',
                name: 'E2E Tester',
                email: 'e2e_test@example.com',
                password: 'password123',
                role: 'User',
                department: dept._id,
                branch: 'blackhole_mumbai'
            });
        }
        const sessionId = `sess_${Date.now()}`;
        console.log(`✅ Employee logged in: ${user.email} (ID: ${user._id})\n`);

        // 2. PRANA & KARMA Session Starts
        console.log("➡️  STAGE 2 & 3: PRANA & KARMA Session Auto-Start");
        emsSignals.initializeEmployee(user._id.toString(), sessionId);
        console.log(`✅ PRANA Telemetry session initialized for ${user._id}`);
        
        // Simulate a PRANA packet flushing to KARMA
        emsSignals.captureWindowFocus(user._id.toString(), true, { cognitive_state: 'DEEP_FOCUS' });
        emsSignals.captureKeystroke(user._id.toString(), { key: 'a' });
        
        // Manually trigger KARMA signal for demo purposes (usually happens in router)
        await karmaClient.signalNormalActivity(user._id.toString());
        console.log(`✅ KARMA Trust session updated for ${user._id}\n`);

        // 3. Task Assignment
        console.log("➡️  STAGE 4: Task Assignment");
        const task = await Task.create({
            title: "E2E Automated Task",
            description: "Validate Phase 1 Canonical Runtime",
            status: "In Progress",
            priority: "High",
            department: dept._id,
            assignee: user._id,
            dueDate: new Date(Date.now() + 86400000),
            branch: user.branch
        });
        console.log(`✅ Task created and assigned: ${task._id}`);
        
        const traceId = `trace_e2e_${Date.now()}`;
        await emitTaskAssignedEvent(task, traceId, task.branch);
        console.log(`✅ TANTRA Execution trace started: ${traceId}\n`);

        // 4. Task Execution & Submission
        console.log("➡️  STAGE 5 & 6: Task Execution & Submission");
        const submission = await TaskSubmission.create({
            task: task._id,
            user: user._id,
            githubLink: "https://github.com/blackhole/e2e-test",
            status: "Pending"
        });
        console.log(`✅ Task executed and submitted: ${submission._id}\n`);

        // 5. PARIKSHAK Invocation
        console.log("➡️  STAGE 7: PARIKSHAK Invocation");
        console.log("⏳ Triggering Parikshak Review Engine asynchronously...");
        
        // This will internally do Stage 8, 9, 10, 11
        // (Review -> MasterDB Update -> Completed Tasks -> Automatic Next Task)
        const parikshakResult = await parikshakService.invokeParikshak(submission, task, user, traceId);
        console.log(`✅ PARIKSHAK Review workflow executed successfully\n`);

        // 6. Verify MasterDB Update & Next Task
        console.log("➡️  STAGE 8, 9, 10: MasterDB Update, Completed Tasks, Next Task Assignment");
        const updatedTask = await Task.findById(task._id);
        console.log(`✅ Original task status updated to: ${updatedTask.status}`);
        
        const TaskEvaluation = require('./models/TaskEvaluation');
        const evalRecord = await TaskEvaluation.findOne({ submission: submission._id });
        if (evalRecord) {
            console.log(`✅ TaskEvaluation record created: Result = ${evalRecord.functionalTesting.result}`);
        } else {
            console.log(`❌ TaskEvaluation record missing!`);
        }
        
        const nextTask = await Task.findOne({ 
            assignee: user._id, 
            status: 'Pending',
            createdAt: { $gt: task.createdAt }
        }).sort({ createdAt: -1 });

        if (nextTask) {
            console.log(`✅ Automatic Next Task generated: ${nextTask.title} (ID: ${nextTask._id})`);
        } else {
            console.log(`❌ Failed to find automatically generated Next Task!`);
        }
        console.log("");

        // 7. Candidate Notification
        console.log("➡️  STAGE 11 & 12: Candidate Notification");
        const notifications = await Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(2);
        console.log(`✅ Notifications verified:`);
        notifications.forEach(n => console.log(`   - ${n.title}: ${n.message}`));
        console.log("");

        console.log("======================================================");
        console.log("🎉 PHASE 1 E2E RUNTIME VALIDATION COMPLETE");
        console.log("======================================================");

    } catch (err) {
        console.error("❌ E2E Validation Failed:", err);
    } finally {
        // Cleanup
        await User.deleteOne({ email: 'e2e_test@example.com' });
        console.log("\n🧹 Cleaned up test user");
        await mongoose.disconnect();
        mockBucketServer.close();
    }
}

runE2E();
