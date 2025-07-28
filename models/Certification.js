const mongoose = require('mongoose');

const certificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  name: {
    type: String,
    required: [true, 'Certification name is required'],
    trim: true,
    maxlength: [200, 'Certification name cannot exceed 200 characters']
  },
  issuer: {
    type: String,
    required: [true, 'Issuer is required'],
    trim: true,
    maxlength: [200, 'Issuer cannot exceed 200 characters']
  },
  credentialId: {
    type: String,
    trim: true,
    maxlength: [100, 'Credential ID cannot exceed 100 characters']
  },
  issueDate: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value <= new Date();
      },
      message: 'Issue date cannot be in the future'
    }
  },
  expiryDate: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true;
        if (this.doesNotExpire) return false;
        return !this.issueDate || value > this.issueDate;
      },
      message: 'Expiry date must be after issue date and cannot be set if certification does not expire'
    }
  },
  credentialUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Credential URL must be a valid HTTP/HTTPS URL'
    }
  },
  doesNotExpire: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked', 'pending'],
    default: 'active'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  skills: [{
    type: String,
    trim: true,
    maxlength: [50, 'Skill name cannot exceed 50 characters']
  }],
  category: {
    type: String,
    enum: ['technical', 'professional', 'academic', 'industry', 'vendor', 'other'],
    default: 'other'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
certificationSchema.index({ user: 1, issueDate: -1 });
certificationSchema.index({ name: 1 });
certificationSchema.index({ issuer: 1 });
certificationSchema.index({ status: 1 });
certificationSchema.index({ category: 1 });
certificationSchema.index({ expiryDate: 1 });
certificationSchema.index({ credentialId: 1 });

// Virtual for certification status based on expiry
certificationSchema.virtual('isExpired').get(function() {
  if (this.doesNotExpire || !this.expiryDate) return false;
  return new Date() > this.expiryDate;
});

// Virtual for days until expiry
certificationSchema.virtual('daysUntilExpiry').get(function() {
  if (this.doesNotExpire || !this.expiryDate) return null;
  
  const now = new Date();
  const diffTime = this.expiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for certification age
certificationSchema.virtual('certificationAge').get(function() {
  if (!this.issueDate) return null;
  
  const now = new Date();
  const diffTime = Math.abs(now - this.issueDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) return `${diffDays} days`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
  return `${Math.floor(diffDays / 365)} years`;
});

// Static methods
certificationSchema.statics.findByUser = function(userId) {
  return this.find({ user: userId }).sort({ issueDate: -1 });
};

certificationSchema.statics.findByIssuer = function(issuer) {
  return this.find({ issuer: new RegExp(issuer, 'i') });
};

certificationSchema.statics.findByCategory = function(category) {
  return this.find({ category });
};

certificationSchema.statics.findActive = function(userId) {
  return this.find({ 
    user: userId, 
    status: 'active',
    $or: [
      { doesNotExpire: true },
      { expiryDate: { $gt: new Date() } },
      { expiryDate: null }
    ]
  });
};

certificationSchema.statics.findExpiring = function(userId, days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    user: userId,
    status: 'active',
    doesNotExpire: false,
    expiryDate: {
      $gte: new Date(),
      $lte: futureDate
    }
  });
};

certificationSchema.statics.findExpired = function(userId) {
  return this.find({
    user: userId,
    doesNotExpire: false,
    expiryDate: { $lt: new Date() }
  });
};

certificationSchema.statics.getCertificationStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$category',
        total: { $sum: 1 },
        active: { 
          $sum: { 
            $cond: [
              { $eq: ['$status', 'active'] }, 
              1, 
              0
            ] 
          } 
        },
        verified: { $sum: { $cond: ['$isVerified', 1, 0] } }
      }
    }
  ]);
  
  return stats;
};

// Instance methods
certificationSchema.methods.verify = function() {
  this.isVerified = true;
  return this.save();
};

certificationSchema.methods.revoke = function() {
  this.status = 'revoked';
  return this.save();
};

certificationSchema.methods.renew = function(newExpiryDate) {
  this.expiryDate = newExpiryDate;
  this.status = 'active';
  return this.save();
};

certificationSchema.methods.addSkill = function(skill) {
  if (!this.skills.includes(skill)) {
    this.skills.push(skill);
  }
  return this.save();
};

certificationSchema.methods.removeSkill = function(skill) {
  this.skills = this.skills.filter(s => s !== skill);
  return this.save();
};

// Pre-save middleware
certificationSchema.pre('save', function(next) {
  // Auto-update status based on expiry
  if (!this.doesNotExpire && this.expiryDate && new Date() > this.expiryDate) {
    this.status = 'expired';
  }
  
  // Clear expiry date if doesn't expire
  if (this.doesNotExpire) {
    this.expiryDate = undefined;
  }
  
  // Remove duplicate skills
  if (this.skills && this.skills.length > 0) {
    this.skills = [...new Set(this.skills.map(skill => skill.trim()).filter(skill => skill))];
  }
  
  next();
});

// Pre-remove middleware
certificationSchema.pre('remove', async function(next) {
  try {
    // Update user's profile completion when certification is removed
    const User = mongoose.model('User');
    const user = await User.findById(this.user);
    if (user) {
      await user.updateProfileCompletion();
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Certification', certificationSchema);