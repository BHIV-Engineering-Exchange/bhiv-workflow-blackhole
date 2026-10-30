const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const User = require('../models/User');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const rudra = await User.findOne({ email: 'blackholeinfiverse90@gmail.com' });
    console.log("Found User:", rudra?.name, rudra?.email, rudra?._id);

    const tasks = await Task.find({ assignee: rudra._id }).sort({ createdAt: -1 }).limit(5);
    console.log(`\n=== RUDRA'S LAST 5 TASKS ===`);
    tasks.forEach((t, i) => {
        console.log(`\n------------------ TASK ${i + 1} ------------------`);
        console.log(`ID:      ${t._id}`);
        console.log(`Title:   ${t.title}`);
        console.log(`Status:  ${t.status}`);
        console.log(`Created: ${t.createdAt}`);
        console.log(`Description:\n${t.description}`);
    });

    const subs = await TaskSubmission.find({ user: rudra._id }).sort({ createdAt: 1 }).populate("task", "title");
    console.log(`\n=== RUDRA'S SUBMISSIONS (Total: ${subs.length}) ===`);
    subs.forEach((s, i) => {
        console.log(`\n------------------ SUBMISSION ${i + 1} ------------------`);
        console.log(`ID:        ${s._id}`);
        console.log(`Task:      ${s.task?.title}`);
        console.log(`Status:    ${s.status}`);
        console.log(`Score:     ${s.parikshakReview?.score}`);
        console.log(`Next Task: ${s.parikshakReview?.nextTask}`);
        console.log(`Notes:     ${s.notes}`);
        console.log(`Feedback:  ${s.feedback}`);
        console.log(`ReviewedAt:${s.parikshakReview?.reviewedAt}`);
    });

    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
