const mongoose = require('mongoose');

// Badge Category Enum
const badgeCategories = {
  GENERAL: 'general',
  LEARNING: 'learning',
  MENTORSHIP: 'mentorship',
  ACHIEVEMENT: 'achievement',
  PROFILE: 'profile',
  SOCIAL: 'social'
};

// Badge Schema
const badgeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Badge name is required'],
    trim: true,
    maxlength: [100, 'Badge name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Badge description is required'],
    trim: true,
    maxlength: [500, 'Badge description cannot exceed 500 characters']
  },
  iconUrl: {
    type: String,
    required: [true, 'Badge icon URL is required'],
    match: [/^https?:\/\/.+/, 'Please provide a valid URL']
  },
  category: {
    type: String,
    required: [true, 'Badge category is required'],
    enum: Object.values(badgeCategories),
    default: badgeCategories.GENERAL
  },
  earnedDate: {
    type: Date,
    default: null
  },
  isEarned: {
    type: Boolean,
    default: false
  },
  progress: {
    type: Number,
    min: [0, 'Progress cannot be negative'],
    default: null
  },
  target: {
    type: Number,
    min: [1, 'Target must be at least 1'],
    default: null
  },
  requirements: {
    type: String,
    trim: true,
    maxlength: [1000, 'Requirements cannot exceed 1000 characters'],
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
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

// Virtual for progress percentage
badgeSchema.virtual('progressPercentage').get(function() {
  if (this.progress !== null && this.target !== null && this.target > 0) {
    return Math.min(Math.round((this.progress / this.target) * 100), 100);
  }
  return null;
});

// Index for better query performance
badgeSchema.index({ userId: 1, category: 1 });
badgeSchema.index({ isEarned: 1 });
badgeSchema.index({ createdAt: -1 });

// Static method to get badge categories
badgeSchema.statics.getCategories = function() {
  return badgeCategories;
};

// Instance method to mark badge as earned
badgeSchema.methods.markAsEarned = function() {
  this.isEarned = true;
  this.earnedDate = new Date();
  if (this.target && this.progress !== null) {
    this.progress = this.target;
  }
  return this.save();
};

// Instance method to update progress
badgeSchema.methods.updateProgress = function(newProgress) {
  if (this.target && newProgress >= this.target) {
    return this.markAsEarned();
  }
  this.progress = newProgress;
  return this.save();
};

module.exports = mongoose.model('Badge', badgeSchema);
module.exports.BadgeCategories = badgeCategories;