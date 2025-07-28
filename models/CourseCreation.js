const mongoose = require('mongoose');
const { LessonType, CourseCreationStatus } = require('./CourseModuleCreation');

// Quiz schema (reused from CourseModuleCreation)
const quizSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length >= 2;
      },
      message: 'Quiz must have at least 2 options'
    }
  },
  correctAnswerIndex: {
    type: Number,
    required: true
  },
  explanation: String
});

// LessonCreation schema (embedded in modules)
const lessonCreationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  type: {
    type: String,
    required: true,
    enum: Object.values(LessonType),
    default: LessonType.VIDEO
  },
  order: {
    type: Number,
    required: true
  },
  videoUrl: String,
  textContent: String,
  attachments: [String],
  duration: {
    type: Number, // in seconds
    min: 0
  },
  isPreview: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  quizzes: [quizSchema]
});

// CourseModuleCreation schema (embedded in course creation)
const courseModuleCreationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  order: {
    type: Number,
    required: true
  },
  lessons: [lessonCreationSchema],
  isPublished: {
    type: Boolean,
    default: false
  }
});

const courseCreationSchema = new mongoose.Schema({
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  creatorName: {
    type: String,
    required: true
  },
  creatorEmail: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  thumbnailUrl: String,
  category: {
    type: String,
    required: true
  },
  subcategory: {
    type: String,
    required: true
  },
  level: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced']
  },
  learningObjectives: [String],
  prerequisites: [String],
  targetAudience: [String],
  price: {
    type: Number,
    min: 0
  },
  isFree: {
    type: Boolean,
    default: false
  },
  promoVideoUrl: String,
  modules: [courseModuleCreationSchema], // Updated to use the new schema
  tags: [String],
  language: {
    type: String,
    required: true,
    default: 'English'
  },
  certificateTemplate: String,
  provideCertificate: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: Object.values(CourseCreationStatus),
    default: CourseCreationStatus.DRAFT
  },
  rejectionReason: String,
  submittedAt: Date,
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  estimatedDuration: {
    type: Number,
    default: 0
  },
  resources: [String],
  allowDiscussions: {
    type: Boolean,
    default: true
  },
  allowDownloads: {
    type: Boolean,
    default: false
  },
  instructorBio: String,
  instructorCredentials: [String]
}, {
  timestamps: true
});

// Indexes
courseCreationSchema.index({ creatorId: 1 });
courseCreationSchema.index({ status: 1 });
courseCreationSchema.index({ category: 1, subcategory: 1 });
courseCreationSchema.index({ createdAt: -1 });

// Virtual for total lessons count
courseCreationSchema.virtual('totalLessons').get(function() {
  return this.modules.reduce((total, module) => total + module.lessons.length, 0);
});

// Virtual for total duration
courseCreationSchema.virtual('totalDuration').get(function() {
  return this.modules.reduce((total, module) => {
    return total + module.lessons.reduce((moduleTotal, lesson) => {
      return moduleTotal + (lesson.duration || 0);
    }, 0);
  }, 0);
});

module.exports = {
  CourseCreation: mongoose.model('CourseCreation', courseCreationSchema),
  CourseCreationStatus,
  LessonType
};