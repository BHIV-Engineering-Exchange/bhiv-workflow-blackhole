const mongoose = require('mongoose');
require('dotenv').config();
const { invokeParikshak } = require('./services/parikshakService');
const TaskSubmission = require('./models/TaskSubmission');
const Task = require('./models/Task');
const User = require('./models/User');

async function runTest() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Get a test user
        const user = await User.findOne({ stillExist: 1 });
        if (!user) {
            console.error('❌ No active user found. Please create one.');
            process.exit(1);
        }

        // 2. Create a dummy task
        const task = new Task({
            title: 'Test Parikshak Integration Task',
            description: 'This is a test task for Parikshak automated review.',
            assignee: user._id,
            status: 'In Progress',
            branch: 'blackhole_mumbai',
            dueDate: new Date(Date.now() + 86400000), // Tomorrow
            department: new mongoose.Types.ObjectId()
        });
        await task.save();
        console.log(`✅ Created test task: ${task._id}`);

        // 3. Create a dummy submission
        const submission = new TaskSubmission({
            task: task._id,
            user: user._id,
            githubLink: 'https://github.com/blackhole/test-repo',
            notes: 'Testing the automated review pipeline.',
            status: 'Pending'
        });
        await submission.save();
        console.log(`✅ Created test submission: ${submission._id}`);

        const { emitTaskAssignedEvent, emitTaskSubmittedEvent } = require('./services/taskExecutionBridge');
        
        // 4. Trace setup
        const mockTraceId = `trace_test_${Date.now()}`;
        console.log(`⏳ Setting up execution context (trace: ${mockTraceId})...`);
        await emitTaskAssignedEvent(task, mockTraceId, task.branch);

        // 5. Trigger Parikshak

        console.log(`⏳ Triggering Parikshak (trace: ${mockTraceId})...`);
        
        // This will attempt to hit localhost:8000/parikshak/review
        // We will await it here for the sake of the script, though in production it's fire-and-forget.
        await invokeParikshak(submission._id, mockTraceId, null);

        // 5. Verify the result
        const updatedSubmission = await TaskSubmission.findById(submission._id);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 PARIKSHAK TEST RESULT');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Submission ID: ${updatedSubmission._id}`);
        console.log(`New Status:    ${updatedSubmission.status}`);
        console.log(`Feedback:      ${updatedSubmission.feedback}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Clean up
        await TaskSubmission.findByIdAndDelete(submission._id);
        await Task.findByIdAndDelete(task._id);
        console.log('✅ Cleaned up test data');

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error during test:', error);
        process.exit(1);
    }
}

runTest();
