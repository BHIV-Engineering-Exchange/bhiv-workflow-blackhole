const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Task = require('../models/Task');

async function dumpFullTasks() {
    await mongoose.connect(process.env.MONGODB_URI);

    const task1 = await Task.findById('6a968d6e36486919b65c3bdd');
    const task2 = await Task.findById('6a968f27ea498102ab806d67');
    const task3 = await Task.findById('6a9bc1799b58c43266310bc5');

    console.log("==================================================================");
    console.log("TASK 1 (ORIGINAL AI INGESTION TASK):");
    console.log("Title:       ", task1.title);
    console.log("Created:     ", task1.createdAt);
    console.log("Full Description:\n", task1.description);
    console.log("==================================================================");
    console.log("\n==================================================================");
    console.log("TASK 2 (PARIKSHAK GENERATED PHASE 2 TASK):");
    console.log("Title:       ", task2.title);
    console.log("Created:     ", task2.createdAt);
    console.log("Full Description:\n", task2.description);
    console.log("==================================================================");
    console.log("\n==================================================================");
    console.log("TASK 3 (PARIKSHAK GENERATED MILESTONE T-GOV-002 TASK):");
    console.log("Title:       ", task3.title);
    console.log("Created:     ", task3.createdAt);
    console.log("Full Description:\n", task3.description);
    console.log("==================================================================");

    process.exit(0);
}

dumpFullTasks().catch(e => { console.error(e); process.exit(1); });
