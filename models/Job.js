const mongoose = require('mongoose');
const { Schema } = mongoose;

// Company Info Schema
const companyInfoSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Website must be a valid URL'
    }
  },
  industry: {
    type: String,
    trim: true
  },
  size: {
    type: String,
    trim: true,
    enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+', '']
  },
  founded: {
    type: String,
    trim: true
  },
  headquarters: {
    type: String,
    trim: true
  }
}, { _id: false });

// Job Schema
const jobSchema = new Schema({
  // Basic job information
  position: {
    type: String,
    required: [true, 'Position is required'],
    trim: true,
    maxlength: [100, 'Position cannot exceed 100 characters']
  },
  company: {
    type: String,
    required: [true, 'Company is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  logoUrl: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Logo URL must be a valid URL'
    }
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  requirements: [{
    type: String,
    trim: true,
    maxlength: [500, 'Each requirement cannot exceed 500 characters']
  }],
  responsibilities: [{
    type: String,
    trim: true,
    maxlength: [500, 'Each responsibility cannot exceed 500 characters']
  }],
  salaryRange: {
    type: String,
    trim: true
  },
  jobType: {
    type: String,
    required: [true, 'Job type is required'],
    enum: {
      values: ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Temporary'],
      message: 'Job type must be one of: Full-time, Part-time, Contract, Freelance, Internship, Temporary'
    }
  },
  experienceLevel: {
    type: String,
    required: [true, 'Experience level is required'],
    enum: {
      values: ['Entry', 'Mid', 'Senior', 'Lead', 'Executive'],
      message: 'Experience level must be one of: Entry, Mid, Senior, Lead, Executive'
    }
  },
  skills: [{
    type: String,
    trim: true,
    maxlength: [50, 'Each skill cannot exceed 50 characters']
  }],
  postedDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  applicationDeadline: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v > this.postedDate;
      },
      message: 'Application deadline must be after posted date'
    }
  },
  isRemote: {
    type: Boolean,
    default: false
  },
  
  // Job posting status management
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'active', 'paused', 'expired', 'rejected', 'closed'],
      message: 'Status must be one of: pending, approved, active, paused, expired, rejected, closed'
    },
    default: 'pending'
  },
  
  // Poster information (User reference instead of separate fields)
  postedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Financial information
  budget: {
    type: Number,
    min: [0, 'Budget cannot be negative']
  },
  
  // Contact information (from company)
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please provide a valid contact email address'
    }
  },
  contactPhone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^[\+]?[1-9][\d]{0,15}$/.test(v.replace(/[\s\-\(\)]/g, ''));
      },
      message: 'Please provide a valid phone number'
    }
  },
  
  // Additional job details
  benefits: [{
    type: String,
    trim: true,
    maxlength: [200, 'Each benefit cannot exceed 200 characters']
  }],
  workingHours: {
    type: String,
    trim: true,
    maxlength: [200, 'Working hours cannot exceed 200 characters']
  },
  isUrgent: {
    type: Boolean,
    default: false
  },
  
  // Existing fields
  companyInfo: companyInfoSchema,
  recommendedCourses: [{
    type: Schema.Types.ObjectId,
    ref: 'Course'
  }],
  applicants: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['applied', 'reviewed', 'shortlisted', 'rejected', 'hired'],
      default: 'applied'
    }
  }],
  bookmarkedBy: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  views: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
jobSchema.index({ position: 'text', company: 'text', description: 'text' });
jobSchema.index({ location: 1 });
jobSchema.index({ jobType: 1 });
jobSchema.index({ experienceLevel: 1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ postedDate: -1 });
jobSchema.index({ status: 1 });
jobSchema.index({ postedBy: 1 });
jobSchema.index({ posterEmail: 1 });
jobSchema.index({ isUrgent: 1 });
jobSchema.index({ 'applicants.user': 1 });
jobSchema.index({ bookmarkedBy: 1 });
jobSchema.index({ budget: 1 });
jobSchema.index({ benefits: 1 });

// Virtual for checking if application deadline has passed
jobSchema.virtual('isExpired').get(function() {
  return this.applicationDeadline && this.applicationDeadline < new Date();
});

// Virtual for days since posted
jobSchema.virtual('daysSincePosted').get(function() {
  return Math.floor((new Date() - this.postedDate) / (1000 * 60 * 60 * 24));
});

// Virtual for application count
jobSchema.virtual('applicationCount').get(function() {
  return this.applicants ? this.applicants.length : 0;
});

// Virtual for bookmark count
jobSchema.virtual('bookmarkCount').get(function() {
  return this.bookmarkedBy ? this.bookmarkedBy.length : 0;
});

// Virtual for checking if job is active and available
jobSchema.virtual('isAvailable').get(function() {
  return this.status === 'active' && !this.isExpired;
});

// Static methods
jobSchema.statics.findActiveJobs = function() {
  return this.find({ 
    status: 'active', 
    $or: [{ applicationDeadline: { $gte: new Date() } }, { applicationDeadline: null }] 
  });
};

jobSchema.statics.findPendingJobs = function() {
  return this.find({ status: 'pending' });
};

jobSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

jobSchema.statics.findUrgentJobs = function() {
  return this.find({ isUrgent: true, status: 'active' });
};

jobSchema.statics.findBySkills = function(skills) {
  return this.find({ skills: { $in: skills }, status: 'active' });
};

jobSchema.statics.findByLocation = function(location) {
  return this.find({ 
    $or: [
      { location: new RegExp(location, 'i') },
      { isRemote: true }
    ],
    status: 'active' 
  });
};

jobSchema.statics.findByBudgetRange = function(minBudget, maxBudget) {
  const query = { status: 'active' };
  if (minBudget !== undefined || maxBudget !== undefined) {
    query.budget = {};
    if (minBudget !== undefined) query.budget.$gte = minBudget;
    if (maxBudget !== undefined) query.budget.$lte = maxBudget;
  }
  return this.find(query);
};

jobSchema.statics.getJobStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalJobs: { $sum: 1 },
        activeJobs: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        pendingJobs: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        urgentJobs: { $sum: { $cond: ['$isUrgent', 1, 0] } },
        remoteJobs: { $sum: { $cond: ['$isRemote', 1, 0] } },
        avgViews: { $avg: '$views' },
        avgBudget: { $avg: '$budget' },
        jobsByType: {
          $push: {
            type: '$jobType',
            count: 1
          }
        },
        jobsByLevel: {
          $push: {
            level: '$experienceLevel',
            count: 1
          }
        },
        jobsByStatus: {
          $push: {
            status: '$status',
            count: 1
          }
        }
      }
    }
  ]);
};

// Instance methods
jobSchema.methods.isBookmarkedBy = function(userId) {
  return this.bookmarkedBy.includes(userId);
};

jobSchema.methods.hasApplied = function(userId) {
  return this.applicants.some(applicant => applicant.user.toString() === userId.toString());
};

jobSchema.methods.addBookmark = function(userId) {
  if (!this.isBookmarkedBy(userId)) {
    this.bookmarkedBy.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

jobSchema.methods.removeBookmark = function(userId) {
  this.bookmarkedBy = this.bookmarkedBy.filter(id => id.toString() !== userId.toString());
  return this.save();
};

jobSchema.methods.addApplication = function(userId) {
  if (!this.hasApplied(userId)) {
    this.applicants.push({ user: userId });
    return this.save();
  }
  throw new Error('User has already applied for this job');
};

jobSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// New methods for status management
jobSchema.methods.approve = function() {
  if (this.status === 'pending') {
    this.status = 'approved';
    return this.save();
  }
  throw new Error('Job can only be approved from pending status');
};

jobSchema.methods.activate = function() {
  if (['approved', 'paused'].includes(this.status)) {
    this.status = 'active';
    return this.save();
  }
  throw new Error('Job can only be activated from approved or paused status');
};

jobSchema.methods.pause = function() {
  if (this.status === 'active') {
    this.status = 'paused';
    return this.save();
  }
  throw new Error('Job can only be paused from active status');
};

jobSchema.methods.close = function() {
  if (['active', 'paused'].includes(this.status)) {
    this.status = 'closed';
    return this.save();
  }
  throw new Error('Job can only be closed from active or paused status');
};

jobSchema.methods.reject = function() {
  if (this.status === 'pending') {
    this.status = 'rejected';
    return this.save();
  }
  throw new Error('Job can only be rejected from pending status');
};

jobSchema.methods.expire = function() {
  this.status = 'expired';
  return this.save();
};

// Pre-save middleware
jobSchema.pre('save', function(next) {
  // Ensure skills are unique and lowercase
  if (this.skills) {
    this.skills = [...new Set(this.skills.map(skill => skill.toLowerCase()))];
  }
  
  // Ensure tags are unique and lowercase
  if (this.tags) {
    this.tags = [...new Set(this.tags.map(tag => tag.toLowerCase()))];
  }
  
  // Ensure benefits are unique
  if (this.benefits) {
    this.benefits = [...new Set(this.benefits)];
  }
  
  // Auto-expire jobs past deadline
  if (this.applicationDeadline && this.applicationDeadline < new Date() && this.status === 'active') {
    this.status = 'expired';
  }
  
  next();
});

// Pre-find middleware to populate company and poster information
jobSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'companyId',
    select: 'name logoUrl industry size headquarters contactEmail contactPhone'
  }).populate({
    path: 'postedBy',
    select: 'name email'
  });
  next();
});

module.exports = mongoose.model('Job', jobSchema);