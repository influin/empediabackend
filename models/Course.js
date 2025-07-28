const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  isPreview: {
    type: Boolean,
    default: false
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  videoUrl: {
    type: String
  },
  type: {
    type: String,
    enum: ['video', 'text', 'quiz', 'assignment', 'document']
  }
}, { _id: false });

const courseModuleSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  lessons: {
    type: Number,
    required: true
  },
  content: [lessonSchema],
  isCompleted: {
    type: Boolean,
    default: false
  },
  progress: {
    type: Number,
    min: 0,
    max: 100
  }
}, { _id: false });

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  instructor: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String
  },
  rating: {
    type: Number,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  duration: {
    type: String
  },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced']
  },
  price: {
    type: Number,
    min: 0
  },
  isFree: {
    type: Boolean,
    default: false
  },
  modules: [courseModuleSchema],
  skills: [{
    type: String,
    trim: true
  }],
  category: {
    type: String,
    trim: true
  },
  isEnrolled: {
    type: Boolean,
    default: false
  },
  progress: {
    type: Number,
    min: 0,
    max: 100
  },
  enrolledDate: {
    type: Date
  },
  lastAccessed: {
    type: Date
  },
  // Updated to reference MentorGuidance model
  mentorGuidance: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MentorGuidance'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  enrolledUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    enrolledDate: {
      type: Date,
      default: Date.now
    },
    progress: {
      type: Number,
      default: 0
    },
    lastAccessed: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes
courseSchema.index({ title: 'text', description: 'text' });
courseSchema.index({ category: 1 });
courseSchema.index({ level: 1 });
courseSchema.index({ isFree: 1 });
courseSchema.index({ rating: -1 });
courseSchema.index({ createdAt: -1 });

// Static methods
courseSchema.statics.getCourseStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalCourses: { $sum: 1 },
        freeCourses: {
          $sum: { $cond: [{ $eq: ['$isFree', true] }, 1, 0] }
        },
        paidCourses: {
          $sum: { $cond: [{ $eq: ['$isFree', false] }, 1, 0] }
        },
        averageRating: { $avg: '$rating' },
        totalEnrollments: { $sum: { $size: '$enrolledUsers' } }
      }
    }
  ]);
};

courseSchema.statics.getCoursesByCategory = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        averageRating: { $avg: '$rating' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Instance methods
courseSchema.methods.enrollUser = function(userId) {
  const existingEnrollment = this.enrolledUsers.find(
    enrollment => enrollment.user.toString() === userId.toString()
  );
  
  if (!existingEnrollment) {
    this.enrolledUsers.push({
      user: userId,
      enrolledDate: new Date(),
      progress: 0,
      lastAccessed: new Date()
    });
  }
  
  return this.save();
};

courseSchema.methods.updateProgress = function(userId, progress) {
  const enrollment = this.enrolledUsers.find(
    enrollment => enrollment.user.toString() === userId.toString()
  );
  
  if (enrollment) {
    enrollment.progress = progress;
    enrollment.lastAccessed = new Date();
  }
  
  return this.save();
};

module.exports = mongoose.model('Course', courseSchema);