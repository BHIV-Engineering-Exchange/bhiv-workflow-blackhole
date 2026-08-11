/**
 * End-to-end test script: verify automatic creation of official Parikshak task
 * document in MongoDB with PDF download link.
 *
 * Run: node server/scripts/test-e2e-task-creation.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Task = require("../models/Task");
const User = require("../models/User");
const Department = require("../models/Department");
const TaskSubmission = require("../models/TaskSubmission");
const { triggerReview } = require("../services/parikshakService");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  // Find a test user and department
  const user = await User.findOne({}).lean();
  const dept = await Department.findOne({}).lean();

  if (!user || !dept) {
    console.error("Test user or department not found");
    process.exit(1);
  }

  // Create temporary test Task
  const initialTask = await Task.create({
    title: "E2E Integration Test Task",
    description: "Testing end-to-end task generation and PDF briefing integration.",
    department: dept._id,
    assignee: user._id,
    priority: "High",
    status: "Pending",
    dueDate: new Date(),
    createdBy: user._id,
  });

  // Create temporary TaskSubmission
  const submission = await TaskSubmission.create({
    task: initialTask._id,
    user: user._id,
    githubLink: "https://github.com/BHIV-Engineering-Exchange/bhiv-workflow-blackhole",
    notes: "Implemented module identity validation, unit tests, and architecture documentation.",
    status: "Pending",
  });

  console.log(`Created test submission ${submission._id} for task ${initialTask._id}`);

  // Trigger review
  await triggerReview({
    submission,
    task: initialTask,
    userName: user.name || "Test User",
    io: null,
    Notification: { create: async () => {} },
    TaskSubmission,
  });

  // Check generated task in MongoDB
  const updatedSub = await TaskSubmission.findById(submission._id).lean();
  console.log("\n--- Parikshak Review Results ---");
  console.log("Status:", updatedSub.parikshakReview?.status);
  console.log("Score:", updatedSub.parikshakReview?.score);
  console.log("Next Task:", updatedSub.parikshakReview?.nextTask);
  console.log("Next Task Title:", updatedSub.parikshakReview?.nextTaskTitle);
  console.log("PDF URL:", updatedSub.parikshakReview?.pdfUrl);
  console.log("Auto-Created Task ID:", updatedSub.parikshakReview?.autoCreatedTaskId);

  if (updatedSub.parikshakReview?.autoCreatedTaskId) {
    const createdTask = await Task.findById(updatedSub.parikshakReview.autoCreatedTaskId).lean();
    console.log("\n--- Auto-Created Task Document in MongoDB ---");
    console.log("Title:", createdTask.title);
    console.log("Assignee:", createdTask.assignee);
    console.log("Status:", createdTask.status);
    console.log("Description:\n", createdTask.description);
  }

  // Clean up test documents
  await Task.findByIdAndDelete(initialTask._id);
  if (updatedSub.parikshakReview?.autoCreatedTaskId) {
    await Task.findByIdAndDelete(updatedSub.parikshakReview.autoCreatedTaskId);
  }
  await TaskSubmission.findByIdAndDelete(submission._id);

  await mongoose.disconnect();
  console.log("\nE2E Test Complete. Cleanup done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
