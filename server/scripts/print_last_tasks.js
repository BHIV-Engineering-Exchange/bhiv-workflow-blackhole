const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Task = require('../models/Task');
const User = require('../models/User');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const rudra = await User.findOne({ email: 'blackholeinfiverse90@gmail.com' });

    const tasks = await Task.find({ assignee: rudra._id }).sort({ createdAt: -1 }).limit(3);
    console.log(`\n=== RUDRA'S LAST 3 TASKS ===`);
    tasks.forEach((t, i) => {
        console.log(`\n------------------ TASK ${i + 1} ------------------`);
        console.log(`ID:      ${t._id}`);
        console.log(`Title:   ${t.title}`);
        console.log(`Status:  ${t.status}`);
        console.log(`Created: ${t.createdAt}`);
        console.log(`Description:\n${t.description}`);
    });

    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
