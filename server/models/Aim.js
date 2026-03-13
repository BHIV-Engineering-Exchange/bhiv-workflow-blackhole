const mongoose = require("mongoose")

const AimSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
  },
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
  aims: {
    type: String,
    required: true,
    trim: true,
  },
  // Enhanced completion status
  completionStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'MVP Achieved'],
    default: 'Pending',
    required: true
  },
  // Legacy support
  completed: {
    type: Boolean,
    default: false,
  },
  // Mandatory comment for completion
  completionComment: {
    type: String,
    trim: true,
    maxlength: 500
  },
  // Location type where work was done (from attendance)
  workLocation: {
    type: String,
    enum: ['Office', 'Home', 'Remote'],
    default: 'Office'
  },
  // Progress tracking from daily progress updates
  progressPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  // Achievements for the day (from progress)
  achievements: {
    type: String,
    trim: true
  },
  // Blockers faced (from progress)
  blockers: {
    type: String,
    trim: true
  },
  // Daily progress notes (from progress)
  progressNotes: {
    type: String,
    trim: true
  },
  // Work session information
  workSessionInfo: {
    startDayTime: Date,
    endDayTime: Date,
    totalHoursWorked: {
      type: Number,
      default: 0
    },
    workLocationTag: {
      type: String,
      enum: ['Office', 'WFH', 'Remote'],
      default: 'Office'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Compound index for fast per-user per-date lookups
AimSchema.index({ user: 1, date: 1 });

// Update the updatedAt field before saving
AimSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  
  // Sync legacy completed field with new completionStatus
  this.completed = this.completionStatus === 'Completed' || this.completionStatus === 'MVP Achieved';
  
  // Validate completion comment for completed aims
  if (this.completionStatus !== 'Pending' && (!this.completionComment || this.completionComment.trim() === '')) {
    const error = new Error('Completion comment is required when marking aim as completed or MVP achieved');
    return next(error);
  }
  
  next();
});

module.exports = mongoose.model("Aim", AimSchema)
