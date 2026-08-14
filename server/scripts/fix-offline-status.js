require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const TaskSubmission = require("../models/TaskSubmission");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const res = await TaskSubmission.updateMany(
    { feedback: /Parikshak review service is currently unavailable/i },
    {
      $set: {
        status: "Pending",
        feedback: "Parikshak AI review service was offline when submitted. Queued in Pending status for manual review."
      }
    }
  );

  console.log(`Updated ${res.modifiedCount} offline submission(s) to Pending status.`);
  await mongoose.disconnect();
}

run().catch(console.error);
