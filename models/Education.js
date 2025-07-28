const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  school: {
    type: String,
    required: [true, 'School name is required'],
    trim: true,
    maxlength: [200, 'School name cannot exceed 200 characters']
  },
  degree: {
    type: String,
    required: [true, 'Degree is required'],
    trim: true,
    maxlength: [100, 'Degree cannot exceed 100 characters']
  },
  field: {
    type: String,
    required: [true, 'Field of study is required'],
    trim: true,
    maxlength: [100, 'Field cannot exceed 100 characters']
  },
  duration: {
    type: String,
    required: [true, 'Duration is required'],
    trim: true,
    maxlength: [50, 'Duration cannot exceed 50 characters']
  },
  grade: {
    type: String,
    trim: true,
    maxlength: [20, 'Grade cannot exceed 20 characters']
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
  isCurrentlyStudying: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  achievements: [{
    type: String,
    trim: true,
    maxlength: [200, 'Achievement cannot exceed 200 characters']
  }],
  gpa: {
    type: Number,
    min: [0, 'GPA cannot be negative'],
    max: [10, 'GPA cannot exceed 10']
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
educationSchema.index({ user: 1 });
educationSchema.index({ user: 1, startDate: -1 });

// Virtual for education ID
educationSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Pre-save middleware to handle currently studying logic
educationSchema.pre('save', function(next) {
  if (this.isCurrentlyStudying) {
    this.endDate = null;
  }
  next();
});

// Static method to find by user
educationSchema.statics.findByUser = function(userId) {
  return this.find({ user: userId }).sort({ startDate: -1 });
};

// Instance method to calculate duration in years
educationSchema.methods.getDurationInYears = function() {
  if (!this.startDate) return null;
  
  const endDate = this.endDate || new Date();
  const diffTime = Math.abs(endDate - this.startDate);
  const diffYears = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 365));
  
  return diffYears;
};

module.exports = mongoose.model('Education', educationSchema);