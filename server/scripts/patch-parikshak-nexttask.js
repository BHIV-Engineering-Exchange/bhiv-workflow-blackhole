/**
 * One-time script: backfill nextTaskTitle/nextTaskDescription on existing
 * TaskSubmission documents where nextTask is set but nextTaskTitle is null.
 *
 * Run: node server/scripts/patch-parikshak-nexttask.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const TaskSubmission = require("../models/TaskSubmission");

const taskArray = require("../../../../bhiv-parikshak/Parikshak-system/db/niyantran_tasks.json");
const taskDB = {};
taskArray.forEach((t) => { taskDB[t.task_id] = t; });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const docs = await TaskSubmission.find({
    "parikshakReview.nextTask": { $exists: true, $ne: null },
    "parikshakReview.nextTaskTitle": null,
  });

  console.log(`Found ${docs.length} submission(s) to patch`);

  for (const doc of docs) {
    const id = doc.parikshakReview.nextTask;
    const t = taskDB[id];
    if (!t) { console.warn(`  No task found for ID: ${id}`); continue; }

    const title = t.capability || t.title || id;
    const description = t.dharma || t.description || null;

    await TaskSubmission.findByIdAndUpdate(doc._id, {
      $set: {
        "parikshakReview.nextTaskTitle": title,
        "parikshakReview.nextTaskDescription": description,
      },
    });
    console.log(`  Patched ${doc._id}: ${id} → "${title}"`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((e) => { console.error(e); process.exit(1); });
