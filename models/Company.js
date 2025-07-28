const mongoose = require('mongoose');
const { Schema } = mongoose;

// Company Schema
const companySchema = new Schema({
  // Owner Information
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required']
  },
  
  // Company Details
  name: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [200, 'Company name cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
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
  logoUrl: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Logo URL must be a valid URL'
    }
  },
  industry: {
    type: String,
    trim: true,
    maxlength: [100, 'Industry cannot exceed 100 characters']
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
    trim: true,
    maxlength: [200, 'Headquarters cannot exceed 200 characters']
  },
  
  // Contact Information
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
  
  // Status and Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  
  // Statistics
  totalJobs: {
    type: Number,
    default: 0
  },
  activeJobs: {
    type: Number,
    default: 0
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

// Indexes
companySchema.index({ ownerId: 1 });
companySchema.index({ name: 'text', description: 'text' });
companySchema.index({ industry: 1 });
companySchema.index({ size: 1 });
companySchema.index({ isVerified: 1 });

// Virtual for company age
companySchema.virtual('companyAge').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Static methods
companySchema.statics.findByOwner = function(ownerId) {
  return this.find({ ownerId, isActive: true });
};

companySchema.statics.findVerified = function() {
  return this.find({ isVerified: true, isActive: true });
};

// Instance methods
companySchema.methods.verify = function() {
  this.isVerified = true;
  this.verificationStatus = 'verified';
  return this.save();
};

companySchema.methods.updateJobStats = async function() {
  const Job = mongoose.model('Job');
  const stats = await Job.aggregate([
    { $match: { companyId: this._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }
      }
    }
  ]);
  
  if (stats.length > 0) {
    this.totalJobs = stats[0].total;
    this.activeJobs = stats[0].active;
  } else {
    this.totalJobs = 0;
    this.activeJobs = 0;
  }
  
  return this.save();
};

module.exports = mongoose.model('Company', companySchema);