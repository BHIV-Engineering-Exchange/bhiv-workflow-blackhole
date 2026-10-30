const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const User = require('../models/User');

async function checkTimeline() {
    await mongoose.connect(process.env.MONGODB_URI);
    const rudra = await User.findOne({ email: 'blackholeinfiverse90@gmail.com' });

    console.log("=== CHECKING TASKS GENERATED FOR RUDRA PARMESHWAR ===");

    // Find all tasks created after Sep 01 2026
    const tasks = await Task.find({
        assignee: rudra._id,
        createdAt: { $gte: new Date("2026-09-01T00:00:00Z") }
    }).sort({ createdAt: 1 });

    for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        console.log(`\n=================== TASK #${i + 1} ===================`);
        console.log(`ID:           ${t._id}`);
        console.log(`Title:        ${t.title}`);
        console.log(`Status:       ${t.status}`);
        console.log(`Progress:     ${t.progress}%`);
        console.log(`Created At:   ${t.createdAt.toISOString()}`);
        console.log(`Branch:       ${t.branch}`);
        console.log(`Dependencies: ${JSON.stringify(t.dependencies)}`);
        console.log(`Description:\n${t.description}`);

        // Check if there is a submission for this task
        const subs = await TaskSubmission.find({ task: t._id }).sort({ createdAt: 1 });
        console.log(`--> Submissions for this task: ${subs.length}`);
        subs.forEach((s, sIdx) => {
            console.log(`    [Sub ${sIdx + 1}] ID: ${s._id} | Status: ${s.status} | ReviewedAt: ${s.parikshakReview?.reviewedAt} | Score: ${s.parikshakReview?.score} | Parikshak NextTask: ${s.parikshakReview?.nextTask}`);
            console.log(`    Feedback: ${s.feedback?.substring(0, 150)}...`);
        });
    }

    // Check if any other task exists in the entire database created after Sep 05 2026 for Rudra
    const laterTasks = await Task.find({
        assignee: rudra._id,
        createdAt: { $gt: new Date("2026-09-06T00:00:00Z") }
    });
    console.log(`\nAny tasks created for Rudra after Sep 5, 2026: ${laterTasks.length}`);
    laterTasks.forEach(t => {
        console.log(`  - ${t._id} | ${t.title} | Created: ${t.createdAt}`);
    });

    process.exit(0);
}

checkTimeline().catch(e => { console.error(e); process.exit(1); });
