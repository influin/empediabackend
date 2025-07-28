const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  title: {
    type: String,
    required: [true, 'Achievement title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  issuer: {
    type: String,
    required: [true, 'Issuer is required'],
    trim: true,
    maxlength: [200, 'Issuer cannot exceed 200 characters']
  },
  date: {
    type: String,
    required: [true, 'Achievement date is required'],
    trim: true,
    maxlength: [50, 'Date cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  imageUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        // Basic URL validation
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Image URL must be a valid HTTP/HTTPS URL'
    }
  },
  achievementDate: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value <= new Date();
      },
      message: 'Achievement date cannot be in the future'
    }
  },
  category: {
    type: String,
    enum: ['academic', 'professional', 'certification', 'award', 'competition', 'volunteer', 'other'],
    default: 'other'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Verification URL must be a valid HTTP/HTTPS URL'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
achievementSchema.index({ user: 1, createdAt: -1 });
achievementSchema.index({ title: 1 });
achievementSchema.index({ issuer: 1 });
achievementSchema.index({ category: 1 });
achievementSchema.index({ isVerified: 1 });

// Virtual for achievement age
achievementSchema.virtual('achievementAge').get(function() {
  if (!this.achievementDate) return null;
  
  const now = new Date();
  const diffTime = Math.abs(now - this.achievementDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
});

// Static methods
achievementSchema.statics.findByUser = function(userId) {
  return this.find({ user: userId }).sort({ createdAt: -1 });
};

achievementSchema.statics.findByIssuer = function(issuer) {
  return this.find({ issuer: new RegExp(issuer, 'i') });
};

achievementSchema.statics.findByCategory = function(category) {
  return this.find({ category });
};

achievementSchema.statics.findVerified = function(userId) {
  return this.find({ user: userId, isVerified: true });
};

achievementSchema.statics.getAchievementStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        verified: { $sum: { $cond: ['$isVerified', 1, 0] } }
      }
    }
  ]);
  
  return stats;
};

// Instance methods
achievementSchema.methods.verify = function() {
  this.isVerified = true;
  return this.save();
};

achievementSchema.methods.unverify = function() {
  this.isVerified = false;
  return this.save();
};

// Pre-save middleware
achievementSchema.pre('save', function(next) {
  // Parse date string to Date object if provided
  if (this.date && !this.achievementDate) {
    try {
      this.achievementDate = new Date(this.date);
    } catch (error) {
      // If parsing fails, keep the string format
    }
  }
  
  next();
});

// Pre-remove middleware
achievementSchema.pre('remove', async function(next) {
  try {
    // Update user's profile completion when achievement is removed
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

module.exports = mongoose.model('Achievement', achievementSchema);