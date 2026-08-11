/**
 * One-time script: reset user's currentParikshakTaskId to T-GOV-001
 * so next submission starts at node 1 and progresses step-by-step.
 *
 * Run: node server/scripts/reset-user-task.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const result = await User.updateMany(
    {},
    { $set: { currentParikshakTaskId: "T-GOV-001" } }
  );

  console.log(`Reset ${result.modifiedCount} user(s) to T-GOV-001`);
  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
