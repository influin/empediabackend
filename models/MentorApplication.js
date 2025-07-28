const mongoose = require('mongoose');

// MentorshipSessionType Schema (embedded)
const mentorshipSessionTypeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Session type is required'],
    enum: ['1:1 Video Call', 'Mock Interview', 'Document Review', 'Text Consultation'],
    trim: true
  },
  duration: {
    type: String,
    required: [true, 'Duration is required'],
    enum: ['30min', '60min', '90min', '120min'],
    default: '60min'
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  }
}, { _id: true });

// Main MentorApplication Schema
// Remove redundant fields and optimize
const mentorApplicationSchema = new mongoose.Schema({
  applicantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Applicant ID is required'],
    unique: true
  },
  
  // Professional Information (keep only what's not in User model)
  currentPosition: {
    type: String,
    required: [true, 'Current position is required'],
    trim: true,
    maxlength: [200, 'Position cannot exceed 200 characters']
  },
  company: {
    type: String,
    required: [true, 'Company is required'],
    trim: true,
    maxlength: [200, 'Company name cannot exceed 200 characters']
  },
  experienceYears: {
    type: Number,
    required: [true, 'Experience years is required'],
    min: [0, 'Experience years cannot be negative'],
    max: [50, 'Experience years cannot exceed 50']
  },
  expertise: {
    type: [String],
    default: []
  },
  
  // Mentorship Information
  bio: {
    type: String,
    required: [true, 'Bio is required'],
    trim: true,
    minlength: [50, 'Bio must be at least 50 characters'],
    maxlength: [2000, 'Bio cannot exceed 2000 characters']
  },
  mentorshipApproach: {
    type: String,
    required: [true, 'Mentorship approach is required'],
    trim: true,
    minlength: [50, 'Mentorship approach must be at least 50 characters'],
    maxlength: [1000, 'Mentorship approach cannot exceed 1000 characters']
  },
  
  // Professional Links
  linkedinUrl: {
    type: String,
    required: [true, 'LinkedIn URL is required'],
    match: [/^https?:\/\/(www\.)?linkedin\.com\/.+/, 'Please provide a valid LinkedIn URL']
  },
  portfolioUrl: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please provide a valid portfolio URL']
  },
  resumeUrl: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please provide a valid resume URL']
  },
  
  // Availability Information
  languages: {
    type: [String],
    default: ['English']
  },
  timezone: {
    type: String,
    required: [true, 'Timezone is required'],
    default: 'UTC'
  },
  availableSessionTypes: {
    type: [mentorshipSessionTypeSchema],
    default: []
  },
  
  // Application Status
  status: {
    type: String,
    enum: ['pending', 'underReview', 'approved', 'rejected', 'waitlisted'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Additional Information
  certifications: {
    type: [String],
    default: []
  },
  education: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Education'
    }],
    default: []
  },
  workExperience: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Experience'
    }],
    default: []
  },
  agreedToTerms: {
    type: Boolean,
    required: [true, 'Agreement to terms is required'],
    validate: {
      validator: function(value) {
        return value === true;
      },
      message: 'Must agree to terms and conditions'
    }
  },
  additionalNotes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Additional notes cannot exceed 1000 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Update approve method to create mentor profile in User model
mentorApplicationSchema.methods.approve = async function(reviewerId) {
  const User = mongoose.model('User');
  
  // Update application status
  this.status = 'approved';
  this.reviewedAt = new Date();
  this.reviewedBy = reviewerId;
  this.rejectionReason = undefined;
  
  // Update user to become mentor
  const user = await User.findById(this.applicantId);
  if (user) {
    await user.becomeMentor({
      position: this.currentPosition,
      bio: this.bio,
      expertise: this.expertise,
      experienceYears: this.experienceYears,
      company: this.company,
      linkedinUrl: this.linkedinUrl,
      availableSessions: this.availableSessionTypes,
      languages: this.languages,
      timezone: this.timezone,
      isAvailable: true,
      verificationStatus: 'verified'
    });
  }
  
  return this.save();
};

// Virtual for application age
mentorApplicationSchema.virtual('applicationAge').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.submittedAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for review duration
mentorApplicationSchema.virtual('reviewDuration').get(function() {
  if (!this.reviewedAt) return null;
  const diffTime = Math.abs(this.reviewedAt - this.submittedAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for applicant details (populated from User)
mentorApplicationSchema.virtual('applicantDetails', {
  ref: 'User',
  localField: 'applicantId',
  foreignField: '_id',
  justOne: true
});

// Static method to get application statistics
mentorApplicationSchema.statics.getApplicationStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const totalApplications = await this.countDocuments();
  const avgReviewTime = await this.aggregate([
    {
      $match: { reviewedAt: { $exists: true } }
    },
    {
      $project: {
        reviewDuration: {
          $divide: [
            { $subtract: ['$reviewedAt', '$submittedAt'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        avgDays: { $avg: '$reviewDuration' }
      }
    }
  ]);
  
  return {
    total: totalApplications,
    byStatus: stats,
    averageReviewTime: avgReviewTime[0]?.avgDays || 0
  };
};

// Instance method to approve application
mentorApplicationSchema.methods.approve = function(reviewerId) {
  this.status = 'approved';
  this.reviewedAt = new Date();
  this.reviewedBy = reviewerId;
  this.rejectionReason = undefined;
  return this.save();
};

// Instance method to reject application
mentorApplicationSchema.methods.reject = function(reviewerId, reason) {
  this.status = 'rejected';
  this.reviewedAt = new Date();
  this.reviewedBy = reviewerId;
  this.rejectionReason = reason;
  return this.save();
};

// Instance method to move to waitlist
mentorApplicationSchema.methods.waitlist = function(reviewerId, reason) {
  this.status = 'waitlisted';
  this.reviewedAt = new Date();
  this.reviewedBy = reviewerId;
  this.rejectionReason = reason;
  return this.save();
};

// Pre-save middleware to update reviewedAt when status changes
mentorApplicationSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== 'pending' && !this.reviewedAt) {
    this.reviewedAt = new Date();
  }
  next();
});

const MentorApplication = mongoose.model('MentorApplication', mentorApplicationSchema);

module.exports = MentorApplication;