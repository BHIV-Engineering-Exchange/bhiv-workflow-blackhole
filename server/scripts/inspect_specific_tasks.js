const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const User = require('../models/User');

async function inspect() {
    await mongoose.connect(process.env.MONGODB_URI);

    // Let's find tasks assigned to Rudra or with "Ingestion" or recently created
    const tasks = await Task.find({
        $or: [
            { title: /ingestion/i },
            { title: /Phase 2/i },
            { title: /Milestone Advancement/i }
        ]
    }).sort({ createdAt: -1 }).limit(10).populate("assignee", "name email");

    console.log("=== INGESTION / GENERATED TASKS ===");
    for (const t of tasks) {
        console.log(`\n------------------------------------------------------------`);
        console.log(`Task ID:     ${t._id}`);
        console.log(`Title:       ${t.title}`);
        console.log(`Status:      ${t.status}`);
        console.log(`Assignee:    ${t.assignee?.name} (${t.assignee?.email})`);
        console.log(`Created:     ${t.createdAt}`);
        console.log(`Description:\n${t.description}`);
        console.log(`Dependencies:`, t.dependencies);
    }

    const subs = await TaskSubmission.find({
        task: { $in: tasks.map(t => t._id) }
    }).sort({ createdAt: -1 }).populate("task", "title").populate("user", "name email");

    console.log("\n\n=== SUBMISSIONS FOR THESE TASKS ===");
    for (const s of subs) {
        console.log(`\n------------------------------------------------------------`);
        console.log(`Sub ID:      ${s._id}`);
        console.log(`Task:        ${s.task?.title}`);
        console.log(`User:        ${s.user?.name}`);
        console.log(`Status:      ${s.status}`);
        console.log(`Score:       ${s.parikshakReview?.score}`);
        console.log(`Next Task:   ${s.parikshakReview?.nextTask}`);
        console.log(`Feedback:\n${s.feedback}`);
        console.log(`AI Review Details:`, JSON.stringify(s.aiReviewDetails, null, 2));
    }

    process.exit(0);
}

inspect().catch(e => { console.error(e); process.exit(1); });
