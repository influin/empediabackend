const { CourseModuleCreation } = require('../models/CourseModuleCreation');
const { CourseCreation } = require('../models/CourseCreation');
const asyncHandler = require('express-async-handler');

// @desc    Get all modules for a course creation
// @route   GET /api/course-creations/:courseId/modules
// @access  Private
const getCourseModules = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  
  // Check if course creation exists and user has access
  const courseCreation = await CourseCreation.findById(courseId);
  if (!courseCreation) {
    return res.status(404).json({
      success: false,
      message: 'Course creation not found'
    });
  }

  // Check access rights
  if (req.user.role !== 'admin' && courseCreation.creatorId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access these modules'
    });
  }

  const modules = await CourseModuleCreation.find({ courseCreationId: courseId })
    .sort({ order: 1 });

  res.status(200).json({
    success: true,
    count: modules.length,
    data: modules
  });
});

// @desc    Get single module
// @route   GET /api/course-creations/:courseId/modules/:id
// @access  Private
const getCourseModule = asyncHandler(async (req, res) => {
  const module = await CourseModuleCreation.findById(req.params.id)
    .populate('courseCreationId', 'title creatorId');

  if (!module) {
    return res.status(404).json({
      success: false,
      message: 'Module not found'
    });
  }

  // Check access rights
  if (req.user.role !== 'admin' && module.courseCreationId.creatorId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this module'
    });
  }

  res.status(200).json({
    success: true,
    data: module
  });
});

// @desc    Create new module
// @route   POST /api/course-creations/:courseId/modules
// @access  Private
const createCourseModule = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  
  // Check if course creation exists and user has access
  const courseCreation = await CourseCreation.findById(courseId);
  if (!courseCreation) {
    return res.status(404).json({
      success: false,
      message: 'Course creation not found'
    });
  }

  // Check access rights
  if (req.user.role !== 'admin' && courseCreation.creatorId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to create modules for this course'
    });
  }

  const moduleData = {
    ...req.body,
    courseCreationId: courseId
  };

  const module = await CourseModuleCreation.create(moduleData);

  res.status(201).json({
    success: true,
    data: module
  });
});

// @desc    Update module
// @route   PUT /api/course-creations/:courseId/modules/:id
// @access  Private
const updateCourseModule = asyncHandler(async (req, res) => {
  let module = await CourseModuleCreation.findById(req.params.id)
    .populate('courseCreationId', 'creatorId status');

  if (!module) {
    return res.status(404).json({
      success: false,
      message: 'Module not found'
    });
  }

  // Check access rights
  if (req.user.role !== 'admin' && module.courseCreationId.creatorId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this module'
    });
  }

  // Don't allow updates if course is already submitted (unless admin)
  if (module.courseCreationId.status !== 'draft' && req.user.role !== 'admin') {
    return res.status(400).json({
      success: false,
      message: 'Cannot update module after course submission'
    });
  }

  module = await CourseModuleCreation.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: module
  });
});

// @desc    Delete module
// @route   DELETE /api/course-creations/:courseId/modules/:id
// @access  Private
const deleteCourseModule = asyncHandler(async (req, res) => {
  const module = await CourseModuleCreation.findById(req.params.id)
    .populate('courseCreationId', 'creatorId status');

  if (!module) {
    return res.status(404).json({
      success: false,
      message: 'Module not found'
    });
  }

  // Check access rights
  if (req.user.role !== 'admin' && module.courseCreationId.creatorId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this module'
    });
  }

  // Don't allow deletion if course is already submitted (unless admin)
  if (module.courseCreationId.status !== 'draft' && req.user.role !== 'admin') {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete module after course submission'
    });
  }

  await CourseModuleCreation.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Module deleted successfully'
  });
});

// @desc    Reorder modules
// @route   PUT /api/course-creations/:courseId/modules/reorder
// @access  Private
const reorderModules = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { moduleOrders } = req.body; // Array of { id, order }
  
  // Check if course creation exists and user has access
  const courseCreation = await CourseCreation.findById(courseId);
  if (!courseCreation) {
    return res.status(404).json({
      success: false,
      message: 'Course creation not found'
    });
  }

  // Check access rights
  if (req.user.role !== 'admin' && courseCreation.creatorId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to reorder modules for this course'
    });
  }

  // Update module orders
  const updatePromises = moduleOrders.map(({ id, order }) => 
    CourseModuleCreation.findByIdAndUpdate(id, { order }, { new: true })
  );

  const updatedModules = await Promise.all(updatePromises);

  res.status(200).json({
    success: true,
    data: updatedModules
  });
});

module.exports = {
  getCourseModules,
  getCourseModule,
  createCourseModule,
  updateCourseModule,
  deleteCourseModule,
  reorderModules
};