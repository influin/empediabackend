const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [200, 'Company name cannot exceed 200 characters']
  },
  position: {
    type: String,
    required: [true, 'Position is required'],
    trim: true,
    maxlength: [100, 'Position cannot exceed 100 characters']
  },
  duration: {
    type: String,
    required: [true, 'Duration is required'],
    trim: true,
    maxlength: [50, 'Duration cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  startDate: {
    type: Date,
    validate: {
      validator: function(value) {
        return !this.endDate || !value || value <= this.endDate;
      },
      message: 'Start date must be before end date'
    }
  },
  endDate: {
    type: Date,
    validate: {
      validator: function(value) {
        return !this.startDate || !value || value >= this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  isCurrentlyWorking: {
    type: Boolean,
    default: false
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters']
  },
  skills: [{
    type: String,
    trim: true,
    maxlength: [50, 'Skill name cannot exceed 50 characters']
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
experienceSchema.index({ user: 1, startDate: -1 });
experienceSchema.index({ company: 1 });
experienceSchema.index({ position: 1 });
experienceSchema.index({ skills: 1 });

// Virtual for experience duration in months
experienceSchema.virtual('durationInMonths').get(function() {
  if (!this.startDate) return null;
  
  const endDate = this.endDate || new Date();
  const diffTime = Math.abs(endDate - this.startDate);
  const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
  return diffMonths;
});

// Static methods
experienceSchema.statics.findByUser = function(userId) {
  return this.find({ user: userId }).sort({ startDate: -1 });
};

experienceSchema.statics.findByCompany = function(company) {
  return this.find({ company: new RegExp(company, 'i') });
};

experienceSchema.statics.findBySkill = function(skill) {
  return this.find({ skills: { $in: [new RegExp(skill, 'i')] } });
};

experienceSchema.statics.findCurrent = function(userId) {
  return this.find({ user: userId, isCurrentlyWorking: true });
};

// Instance methods
experienceSchema.methods.addSkill = function(skill) {
  if (!this.skills.includes(skill)) {
    this.skills.push(skill);
  }
  return this.save();
};

experienceSchema.methods.removeSkill = function(skill) {
  this.skills = this.skills.filter(s => s !== skill);
  return this.save();
};

experienceSchema.methods.updateSkills = function(skills) {
  this.skills = [...new Set(skills)]; // Remove duplicates
  return this.save();
};

// Pre-save middleware
experienceSchema.pre('save', function(next) {
  // If currently working, remove end date
  if (this.isCurrentlyWorking) {
    this.endDate = undefined;
  }
  
  // Remove duplicate skills
  if (this.skills && this.skills.length > 0) {
    this.skills = [...new Set(this.skills.map(skill => skill.trim()).filter(skill => skill))];
  }
  
  next();
});

// Pre-remove middleware
experienceSchema.pre('remove', async function(next) {
  try {
    // Update user's profile completion when experience is removed
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

module.exports = mongoose.model('Experience', experienceSchema);