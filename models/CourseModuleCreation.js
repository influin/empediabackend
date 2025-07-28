const mongoose = require('mongoose');

// Enums
const LessonType = {
  VIDEO: 'video',
  TEXT: 'text',
  QUIZ: 'quiz',
  ASSIGNMENT: 'assignment',
  DOCUMENT: 'document',
  AUDIO: 'audio'
};

const CourseCreationStatus = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'underReview',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};

// Quiz schema
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
    required: true,
    validate: {
      validator: function(v) {
        return v >= 0 && v < this.options.length;
      },
      message: 'Correct answer index must be valid'
    }
  },
  explanation: String
});

// LessonCreation schema
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
  videoUrl: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || this.type === LessonType.VIDEO || this.type === LessonType.AUDIO;
      },
      message: 'Video URL can only be set for video or audio lessons'
    }
  },
  textContent: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || this.type === LessonType.TEXT || this.type === LessonType.DOCUMENT;
      },
      message: 'Text content can only be set for text or document lessons'
    }
  },
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
  quizzes: {
    type: [quizSchema],
    validate: {
      validator: function(v) {
        return !v || v.length === 0 || this.type === LessonType.QUIZ;
      },
      message: 'Quizzes can only be added to quiz-type lessons'
    }
  }
});

// CourseModuleCreation schema
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
  },
  courseCreationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseCreation',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
courseModuleCreationSchema.index({ courseCreationId: 1, order: 1 });
courseModuleCreationSchema.index({ isPublished: 1 });
lessonCreationSchema.index({ order: 1 });

// Virtual for lesson count
courseModuleCreationSchema.virtual('lessonCount').get(function() {
  return this.lessons.length;
});

// Virtual for total duration
courseModuleCreationSchema.virtual('totalDuration').get(function() {
  return this.lessons.reduce((total, lesson) => total + (lesson.duration || 0), 0);
});

module.exports = {
  CourseModuleCreation: mongoose.model('CourseModuleCreation', courseModuleCreationSchema),
  LessonCreation: lessonCreationSchema,
  Quiz: quizSchema,
  LessonType,
  CourseCreationStatus
};