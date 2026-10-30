const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Task = require('../models/Task');
const User = require('../models/User');
const TaskSubmission = require('../models/TaskSubmission');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB successfully\n");

    // Search tasks with "ingestion" or "AI" or recent 15 tasks
    const allTasks = await Task.find({}).sort({ createdAt: -1 }).limit(15).populate("assignee", "name email");

    console.log("=================== RECENT 15 TASKS ===================");
    allTasks.forEach((t, i) => {
        console.log(`[Task ${i+1}]`);
        console.log(`  ID:          ${t._id}`);
        console.log(`  Title:       ${t.title}`);
        console.log(`  Status:      ${t.status}`);
        console.log(`  Assignee:    ${t.assignee?.name || t.assignee} (${t.assignee?.email || ''})`);
        console.log(`  Created:     ${t.createdAt}`);
        console.log(`  Description: ${t.description ? t.description.substring(0, 150).replace(/\n/g, ' ') : 'N/A'}...`);
        console.log('-------------------------------------------------------');
    });

    console.log("\n=================== RECENT SUBMISSIONS ===================");
    const submissions = await TaskSubmission.find({}).sort({ createdAt: -1 }).limit(8).populate("task").populate("user", "name email");
    submissions.forEach((s, i) => {
        console.log(`[Submission ${i+1}]`);
        console.log(`  Sub ID:      ${s._id}`);
        console.log(`  Task ID:     ${s.task?._id} - ${s.task?.title}`);
        console.log(`  User:        ${s.user?.name} (${s.user?.email})`);
        console.log(`  Status:      ${s.status}`);
        console.log(`  Score:       ${s.parikshakReview?.score}`);
        console.log(`  NextTask:    ${s.parikshakReview?.nextTask}`);
        console.log(`  Feedback:    ${s.feedback ? s.feedback.substring(0, 150).replace(/\n/g, ' ') : 'N/A'}...`);
        console.log('-------------------------------------------------------');
    });

    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
