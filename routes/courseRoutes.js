const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/auth');
const {
  validateCourseCreation,
  validateCourseUpdate,
  validateProgressUpdate,
  validateCourseQuery,
  handleValidationErrors
} = require('../middleware/courseValidation');

// All routes require authentication
router.use(protect);

// Course CRUD routes
router.route('/')
  .get(validateCourseQuery, handleValidationErrors, courseController.getAllCourses)
  .post(authorize('admin', 'instructor'), validateCourseCreation, handleValidationErrors, courseController.createCourse);

// Search courses
router.get('/search', validateCourseQuery, handleValidationErrors, courseController.searchCourses);

// Course statistics (admin only)
router.get('/stats', authorize('admin'), courseController.getCourseStats);

// Get courses by category
router.get('/category/:category', validateCourseQuery, handleValidationErrors, courseController.getCoursesByCategory);

// User's enrolled courses
router.get('/user/:userId', courseController.getUserCourses);
router.get('/my-courses', courseController.getUserCourses);

// Course enrollment
router.post('/:id/enroll', courseController.enrollInCourse);

// Update course progress
router.put('/:id/progress', validateProgressUpdate, handleValidationErrors, courseController.updateCourseProgress);

// Individual course routes
router.route('/:id')
  .get(courseController.getCourseById)
  .put(authorize('admin', 'instructor'), validateCourseUpdate, handleValidationErrors, courseController.updateCourse)
  .delete(authorize('admin', 'instructor'), courseController.deleteCourse);

module.exports = router;