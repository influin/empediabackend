const mongoose = require('mongoose');

// Define the JobApplication schema
const jobApplicationSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  jobTitle: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  applicantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  applicantName: {
    type: String,
    required: true
  },
  applicantEmail: {
    type: String,
    required: true
  },
  resumeUrl: {
    type: String
  },
  coverLetter: {
    type: String
  },
  portfolioUrl: {
    type: String
  },
  linkedinUrl: {
    type: String
  },
  status: {
    type: String,
    enum: ['submitted', 'underReview', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn'],
    default: 'submitted'
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  },
  reviewerNotes: {
    type: String
  },
  attachments: [{
    type: String
  }],
  customFields: {
    type: mongoose.Schema.Types.Mixed
  },
  rejectionReason: {
    type: String
  },
  interviewDate: {
    type: Date
  },
  interviewNotes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
jobApplicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });
jobApplicationSchema.index({ status: 1 });
jobApplicationSchema.index({ appliedAt: -1 });
jobApplicationSchema.index({ company: 1 });

// Virtual for days since applied
jobApplicationSchema.virtual('daysSinceApplied').get(function() {
  return Math.floor((Date.now() - this.appliedAt) / (1000 * 60 * 60 * 24));
});

// Virtual to check if application is active
jobApplicationSchema.virtual('isActive').get(function() {
  return !['hired', 'rejected', 'withdrawn'].includes(this.status);
});

// Static methods
jobApplicationSchema.statics.findByJob = function(jobId) {
  return this.find({ jobId }).populate('applicantId', 'firstName lastName email profilePicture');
};

jobApplicationSchema.statics.findByApplicant = function(applicantId) {
  return this.find({ applicantId }).populate('jobId', 'position company location salary');
};

jobApplicationSchema.statics.getApplicationStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Instance methods
jobApplicationSchema.methods.updateStatus = function(newStatus, reviewerNotes) {
  this.status = newStatus;
  this.reviewedAt = new Date();
  if (reviewerNotes) {
    this.reviewerNotes = reviewerNotes;
  }
  return this.save();
};

jobApplicationSchema.methods.scheduleInterview = function(interviewDate, notes) {
  this.status = 'interviewed';
  this.interviewDate = interviewDate;
  if (notes) {
    this.interviewNotes = notes;
  }
  return this.save();
};

jobApplicationSchema.methods.reject = function(reason) {
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.reviewedAt = new Date();
  return this.save();
};

jobApplicationSchema.methods.withdraw = function() {
  this.status = 'withdrawn';
  return this.save();
};

module.exports = mongoose.model('JobApplication', jobApplicationSchema);