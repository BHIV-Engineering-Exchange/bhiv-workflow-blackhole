const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  startDate: { 
    type: Date, 
    required: true,
    index: true
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  reason: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 500
  },
  leaveType: {
    type: String,
    enum: ['Sick', 'Vacation', 'Personal', 'Emergency', 'Maternity', 'Paternity', 'Other'],
    default: 'Personal'
  },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending',
    index: true
  },
  approvedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: 300
  },
  documents: [{
    filename: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  totalDays: {
    type: Number,
    required: true
  },
  isHalfDay: {
    type: Boolean,
    default: false
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  handoverNotes: {
    type: String,
    maxlength: 1000
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  // Branch - Office location for this leave request
  branch: {
    type: String,
    default: 'blackhole_mumbai',
    index: true,
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  approvedAt: Date,
  rejectedAt: Date
}, {
  timestamps: true
});

// Calculate total days before saving
leaveSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const timeDiff = this.endDate.getTime() - this.startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    this.totalDays = this.isHalfDay ? daysDiff * 0.5 : daysDiff;
  }
  this.updatedAt = Date.now();
  next();
});

// Compound indexes for efficient queries
leaveSchema.index({ user: 1, startDate: -1 });
leaveSchema.index({ status: 1, createdAt: -1 });
leaveSchema.index({ approvedBy: 1, status: 1 });

// Virtual for leave duration in a readable format
leaveSchema.virtual('duration').get(function() {
  if (this.totalDays === 1) {
    return this.isHalfDay ? '0.5 day' : '1 day';
  }
  return `${this.totalDays} days`;
});

// Virtual for status color coding
leaveSchema.virtual('statusColor').get(function() {
  const colors = {
    'Pending': '#f59e0b',
    'Approved': '#10b981',
    'Rejected': '#ef4444'
  };
  return colors[this.status] || '#6b7280';
});

// Static method to get leave statistics
leaveSchema.statics.getLeaveStats = async function(userId, year = new Date().getFullYear()) {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);
  
  const stats = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        startDate: { $gte: startOfYear, $lte: endOfYear }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalDays: { $sum: '$totalDays' }
      }
    }
  ]);
  
  return stats;
};

module.exports = mongoose.model('Leave', leaveSchema);
