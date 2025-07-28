const { CourseCreation, CourseCreationStatus } = require('../models/CourseCreation');
const { Course } = require('../models/Course');
const asyncHandler = require('express-async-handler');

// @desc    Get all course creations
// @route   GET /api/course-creations
// @access  Private (Admin)
const getAllCourseCreations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.creatorId) filter.creatorId = req.query.creatorId;

  const courseCreations = await CourseCreation.find(filter)
    .populate('creatorId', 'name email')
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await CourseCreation.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: courseCreations.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: courseCreations
  });
});

// @desc    Get course creation by ID
// @route   GET /api/course-creations/:id
// @access  Private
const getCourseCreationById = asyncHandler(async (req, res) => {
  const courseCreation = await CourseCreation.findById(req.params.id)
    .populate('creatorId', 'name email')
    .populate('reviewedBy', 'name email');

  if (!courseCreation) {
    return res.status(404).json({
      success: false,
      message: 'Course creation not found'
    });
  }

  // Check if user can access this course creation
  if (req.user.role !== 'admin' && courseCreation.creatorId._id.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this course creation'
    });
  }

  res.status(200).json({
    success: true,
    data: courseCreation
  });
});

// @desc    Create new course creation
// @route   POST /api/course-creations
// @access  Private (Instructor)
const createCourseCreation = asyncHandler(async (req, res) => {
  const courseCreationData = {
    ...req.body,
    creatorId: req.user.id,
    creatorName: req.user.name,
    creatorEmail: req.user.email
  };

  const courseCreation = await CourseCreation.create(courseCreationData);

  res.status(201).json({
    success: true,
    data: courseCreation
  });
});

// @desc    Update course creation
// @route   PUT /api/course-creations/:id
// @access  Private (Creator or Admin)
const updateCourseCreation = asyncHandler(async (req, res) => {
  let courseCreation = await CourseCreation.findById(req.params.id);

  if (!courseCreation) {
    return res.status(404).json({
      success: false,
      message: 'Course creation not found'
    });
  }

  // Check ownership or admin role
  if (req.user.role !== 'admin' && courseCreation.creatorId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this course creation'
    });
  }

  // Don't allow updates if already submitted (unless admin)
  if (courseCreation.status !== CourseCreationStatus.DRAFT && req.user.role !== 'admin') {
    return res.status(400).json({
      success: false,
      message: 'Cannot update course creation after submission'
    });
  }

  courseCreation = await CourseCreation.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedAt: new Date() },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: courseCreation
  });
});

// @desc    Submit course creation for review
// @route   PUT /api/course-creations/:id/submit
// @access  Private (Creator)
const submitCourseCreation = asyncHandler(async (req, res) => {
  const courseCreation = await CourseCreation.findById(req.params.id);

  if (!courseCreation) {
    return res.status(404).json({
      success: false,
      message: 'Course creation not found'
    });
  }

  // Check ownership
  if (courseCreation.creatorId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to submit this course creation'
    });
  }

  // Check if already submitted
  if (courseCreation.status !== CourseCreationStatus.DRAFT) {
    return res.status(400).json({
      success: false,
      message: 'Course creation already submitted'
    });
  }

  courseCreation.status = CourseCreationStatus.SUBMITTED;
  courseCreation.submittedAt = new Date();
  await courseCreation.save();

  res.status(200).json({
    success: true,
    data: courseCreation
  });
});

// @desc    Review course creation (approve/reject)
// @route   PUT /api/course-creations/:id/review
// @access  Private (Admin)
const reviewCourseCreation = asyncHandler(async (req, res) => {
  const { action, rejectionReason } = req.body;
  
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be approve or reject'
    });
  }

  const courseCreation = await CourseCreation.findById(req.params.id);

  if (!courseCreation) {
    return res.status(404).json({
      success: false,
      message: 'Course creation not found'
    });
  }

  if (courseCreation.status !== CourseCreationStatus.SUBMITTED) {
    return res.status(400).json({
      success: false,
      message: 'Course creation must be submitted for review'
    });
  }

  courseCreation.status = action === 'approve' ? CourseCreationStatus.APPROVED : CourseCreationStatus.REJECTED;
  courseCreation.reviewedAt = new Date();
  courseCreation.reviewedBy = req.user.id;
  
  if (action === 'reject' && rejectionReason) {
    courseCreation.rejectionReason = rejectionReason;
  }

  await courseCreation.save();

  res.status(200).json({
    success: true,
    data: courseCreation
  });
});

// @desc    Publish approved course creation
// @route   PUT /api/course-creations/:id/publish
// @access  Private (Admin)
const publishCourseCreation = asyncHandler(async (req, res) => {
  const courseCreation = await CourseCreation.findById(req.params.id);

  if (!courseCreation) {
    return res.status(404).json({
      success: false,
      message: 'Course creation not found'
    });
  }

  if (courseCreation.status !== CourseCreationStatus.APPROVED) {
    return res.status(400).json({
      success: false,
      message: 'Course creation must be approved before publishing'
    });
  }

  // Create actual course from course creation
  const courseData = {
    title: courseCreation.title,
    description: courseCreation.description,
    instructor: courseCreation.creatorId,
    thumbnailUrl: courseCreation.thumbnailUrl,
    category: courseCreation.category,
    subcategory: courseCreation.subcategory,
    level: courseCreation.level,
    learningObjectives: courseCreation.learningObjectives,
    prerequisites: courseCreation.prerequisites,
    targetAudience: courseCreation.targetAudience,
    price: courseCreation.price,
    isFree: courseCreation.isFree,
    promoVideoUrl: courseCreation.promoVideoUrl,
    modules: courseCreation.modules,
    tags: courseCreation.tags,
    language: courseCreation.language,
    certificateTemplate: courseCreation.certificateTemplate,
    provideCertificate: courseCreation.provideCertificate,
    estimatedDuration: courseCreation.estimatedDuration,
    resources: courseCreation.resources,
    allowDiscussions: courseCreation.allowDiscussions,
    allowDownloads: courseCreation.allowDownloads,
    instructorBio: courseCreation.instructorBio,
    instructorCredentials: courseCreation.instructorCredentials,
    isPublished: true
  };

  const course = await Course.create(courseData);
  
  courseCreation.status = CourseCreationStatus.PUBLISHED;
  await courseCreation.save();

  res.status(200).json({
    success: true,
    data: {
      courseCreation,
      publishedCourse: course
    }
  });
});

// @desc    Delete course creation
// @route   DELETE /api/course-creations/:id
// @access  Private (Creator or Admin)
const deleteCourseCreation = asyncHandler(async (req, res) => {
  const courseCreation = await CourseCreation.findById(req.params.id);

  if (!courseCreation) {
    return res.status(404).json({
      success: false,
      message: 'Course creation not found'
    });
  }

  // Check ownership or admin role
  if (req.user.role !== 'admin' && courseCreation.creatorId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this course creation'
    });
  }

  await CourseCreation.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Course creation deleted successfully'
  });
});

// @desc    Get user's course creations
// @route   GET /api/course-creations/my-creations
// @access  Private
const getMyCourseCreations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = { creatorId: req.user.id };
  if (req.query.status) filter.status = req.query.status;

  const courseCreations = await CourseCreation.find(filter)
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await CourseCreation.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: courseCreations.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: courseCreations
  });
});

// @desc    Get course creation statistics
// @route   GET /api/course-creations/stats
// @access  Private (Admin)
const getCourseCreationStats = asyncHandler(async (req, res) => {
  const stats = await CourseCreation.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const categoryStats = await CourseCreation.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const monthlyStats = await CourseCreation.aggregate([
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  res.status(200).json({
    success: true,
    data: {
      statusStats: stats,
      categoryStats,
      monthlyStats
    }
  });
});

module.exports = {
  getAllCourseCreations,
  getCourseCreationById,
  createCourseCreation,
  updateCourseCreation,
  submitCourseCreation,
  reviewCourseCreation,
  publishCourseCreation,
  deleteCourseCreation,
  getMyCourseCreations,
  getCourseCreationStats
};