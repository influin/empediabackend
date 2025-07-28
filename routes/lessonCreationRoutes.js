const express = require('express');
const router = express.Router({ mergeParams: true }); // To access courseId and moduleId from parent routes
const { CourseModuleCreation } = require('../models/CourseModuleCreation');
const { CourseCreation } = require('../models/CourseCreation');
const { protect, authorize } = require('../middleware/auth');
const {
  validateLessonCreation,
  validateLessonUpdate,
  validateQuizCreation,
  validateLessonQuery,
  validateLessonId,
  handleValidationErrors
} = require('../middleware/lessonCreationValidation');
const asyncHandler = require('express-async-handler');

// All routes require authentication
router.use(protect);

// Get all lessons in a module
router.get('/', validateLessonQuery, handleValidationErrors, asyncHandler(async (req, res) => {
  const { courseId, moduleId } = req.params;
  
  // Check if using embedded approach (courseId) or standalone (moduleId)
  let lessons = [];
  
  if (courseId) {
    // Embedded approach - get lessons from course creation
    const courseCreation = await CourseCreation.findById(courseId);
    if (!courseCreation) {
      return res.status(404).json({ success: false, message: 'Course creation not found' });
    }
    
    const module = courseCreation.modules.id(moduleId);
    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }
    
    lessons = module.lessons;
  } else {
    // Standalone approach - get lessons from module creation
    const moduleCreation = await CourseModuleCreation.findById(moduleId);
    if (!moduleCreation) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }
    
    lessons = moduleCreation.lessons;
  }
  
  // Apply filters
  if (req.query.type) {
    lessons = lessons.filter(lesson => lesson.type === req.query.type);
  }
  if (req.query.isPublished !== undefined) {
    lessons = lessons.filter(lesson => lesson.isPublished === (req.query.isPublished === 'true'));
  }
  if (req.query.isPreview !== undefined) {
    lessons = lessons.filter(lesson => lesson.isPreview === (req.query.isPreview === 'true'));
  }
  
  // Sort by order
  lessons.sort((a, b) => a.order - b.order);
  
  res.status(200).json({
    success: true,
    count: lessons.length,
    data: lessons
  });
}));

// Get single lesson
router.get('/:lessonId', validateLessonId, handleValidationErrors, asyncHandler(async (req, res) => {
  const { courseId, moduleId, lessonId } = req.params;
  
  let lesson = null;
  
  if (courseId) {
    const courseCreation = await CourseCreation.findById(courseId);
    if (!courseCreation) {
      return res.status(404).json({ success: false, message: 'Course creation not found' });
    }
    
    const module = courseCreation.modules.id(moduleId);
    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }
    
    lesson = module.lessons.id(lessonId);
  } else {
    const moduleCreation = await CourseModuleCreation.findById(moduleId);
    if (!moduleCreation) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }
    
    lesson = moduleCreation.lessons.id(lessonId);
  }
  
  if (!lesson) {
    return res.status(404).json({ success: false, message: 'Lesson not found' });
  }
  
  res.status(200).json({
    success: true,
    data: lesson
  });
}));

// Create new lesson
router.post('/', authorize('instructor', 'admin'), validateLessonCreation, handleValidationErrors, asyncHandler(async (req, res) => {
  const { courseId, moduleId } = req.params;
  
  if (courseId) {
    const courseCreation = await CourseCreation.findById(courseId);
    if (!courseCreation) {
      return res.status(404).json({ success: false, message: 'Course creation not found' });
    }
    
    // Check ownership
    if (req.user.role !== 'admin' && courseCreation.creatorId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const module = courseCreation.modules.id(moduleId);
    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }
    
    module.lessons.push(req.body);
    await courseCreation.save();
    
    const newLesson = module.lessons[module.lessons.length - 1];
    
    res.status(201).json({
      success: true,
      data: newLesson
    });
  } else {
    const moduleCreation = await CourseModuleCreation.findById(moduleId);
    if (!moduleCreation) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }
    
    moduleCreation.lessons.push(req.body);
    await moduleCreation.save();
    
    const newLesson = moduleCreation.lessons[moduleCreation.lessons.length - 1];
    
    res.status(201).json({
      success: true,
      data: newLesson
    });
  }
}));

// Update lesson
router.put('/:lessonId', authorize('instructor', 'admin'), validateLessonId, validateLessonUpdate, handleValidationErrors, asyncHandler(async (req, res) => {
  const { courseId, moduleId, lessonId } = req.params;
  
  if (courseId) {
    const courseCreation = await CourseCreation.findById(courseId);
    if (!courseCreation) {
      return res.status(404).json({ success: false, message: 'Course creation not found' });
    }
    
    // Check ownership
    if (req.user.role !== 'admin' && courseCreation.creatorId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const module = courseCreation.modules.id(moduleId);
    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }
    
    const lesson = module.lessons.id(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }
    
    Object.assign(lesson, req.body);
    await courseCreation.save();
    
    res.status(200).json({
      success: true,
      data: lesson
    });
  } else {
    const moduleCreation = await CourseModuleCreation.findById(moduleId);
    if (!moduleCreation) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }
    
    const lesson = moduleCreation.lessons.id(lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }
    
    Object.assign(lesson, req.body);
    await moduleCreation.save();
    
    res.status(200).json({
      success: true,
      data: lesson
    });
  }
}));

// Delete lesson
router.delete('/:lessonId', authorize('instructor', 'admin'), validateLessonId, handleValidationErrors, asyncHandler(async (req, res) => {
  const { courseId, moduleId, lessonId } = req.params;
  
  if (courseId) {
    const courseCreation = await CourseCreation.findById(courseId);
    if (!courseCreation) {
      return res.status(404).json({ success: false, message: 'Course creation not found' });
    }
    
    // Check ownership
    if (req.user.role !== 'admin' && courseCreation.creatorId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const module = courseCreation.modules.id(moduleId);
    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }
    
    module.lessons.id(lessonId).remove();
    await courseCreation.save();
  } else {
    const moduleCreation = await CourseModuleCreation.findById(moduleId);
    if (!moduleCreation) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }
    
    moduleCreation.lessons.id(lessonId).remove();
    await moduleCreation.save();
  }
  
  res.status(200).json({
    success: true,
    message: 'Lesson deleted successfully'
  });
}));

module.exports = router;