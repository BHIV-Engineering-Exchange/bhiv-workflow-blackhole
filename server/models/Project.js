const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: "",
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    required: true,
  },
  // Team members working on this project
  teamMembers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  // Project lead/manager
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  // Related tasks
  tasks: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
  ],
  status: {
    type: String,
    enum: ["Planning", "In Progress", "On Hold", "Completed", "Cancelled"],
    default: "Planning",
  },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High", "Critical"],
    default: "Medium",
  },
  // Overall project progress (0-100)
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  startDate: {
    type: Date,
  },
  dueDate: {
    type: Date,
  },
  completedDate: {
    type: Date,
  },
  // Project color for UI display
  color: {
    type: String,
    default: "bg-blue-500",
  },
  // Branch/office location
  branch: {
    type: String,
    default: "blackhole_mumbai",
    index: true,
  },
  // Created by (admin)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
ProjectSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Calculate progress based on tasks
ProjectSchema.methods.calculateProgress = async function () {
  if (!this.tasks || this.tasks.length === 0) {
    this.progress = 0;
    return this.progress;
  }

  const Task = mongoose.model("Task");
  const tasks = await Task.find({ _id: { $in: this.tasks } });

  if (tasks.length === 0) {
    this.progress = 0;
    return this.progress;
  }

  // Calculate progress based on task completion
  const completedTasks = tasks.filter((t) => t.status === "Completed").length;
  const inProgressTasks = tasks.filter((t) => t.status === "In Progress").length;

  // Completed = 100%, In Progress = 50%, Pending = 0%
  const totalProgress =
    completedTasks * 100 + inProgressTasks * 50;
  this.progress = Math.round(totalProgress / tasks.length);

  return this.progress;
};

module.exports = mongoose.model("Project", ProjectSchema);
