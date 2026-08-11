require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Task = require("../models/Task");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const tasks = await Task.find({ description: { $regex: "pdf" } });
  console.log(`Found ${tasks.length} tasks with PDF URLs.`);

  for (let t of tasks) {
    t.description = t.description.replace(
      /https?:\/\/[^\s\)]+?\/(?:parikshak\/task-pdf|api\/parikshak\/task-pdf|api\/v1\/next-task)\/([^\/\s\)]+)(?:\/pdf)?/g,
      "http://localhost:5000/api/tasks/parikshak-pdf/$1"
    );
    await t.save();
    console.log(`Updated task "${t.title}" (${t._id})`);
  }

  await mongoose.disconnect();
  console.log("Migration complete.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
