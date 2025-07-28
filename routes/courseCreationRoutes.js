const express = require('express');
const router = express.Router();
const courseCreationController = require('../controllers/courseCreationController');
const { protect, authorize } = require('../middleware/auth');
const {
  validateCourseCreationCreation,
  validateCourseCreationUpdate,
  validateCourseCreationQuery,
  validateReviewAction,
  validateCourseCreationId,
  handleValidationErrors
} = require('../middleware/courseCreationValidation');

// All routes require authentication
router.use(protect);

// Course creation CRUD routes
router.route('/')
  .get(authorize('admin'), validateCourseCreationQuery, handleValidationErrors, courseCreationController.getAllCourseCreations)
  .post(authorize('instructor', 'admin'), validateCourseCreationCreation, handleValidationErrors, courseCreationController.createCourseCreation);

// Get user's own course creations
router.get('/my-creations', validateCourseCreationQuery, handleValidationErrors, courseCreationController.getMyCourseCreations);

// Course creation statistics (admin only)
router.get('/stats', authorize('admin'), courseCreationController.getCourseCreationStats);

// Submit course creation for review
router.put('/:id/submit', validateCourseCreationId, handleValidationErrors, courseCreationController.submitCourseCreation);

// Review course creation (admin only)
router.put('/:id/review', authorize('admin'), validateCourseCreationId, validateReviewAction, handleValidationErrors, courseCreationController.reviewCourseCreation);

// Publish approved course creation (admin only)
router.put('/:id/publish', authorize('admin'), validateCourseCreationId, handleValidationErrors, courseCreationController.publishCourseCreation);

// Individual course creation routes
router.route('/:id')
  .get(validateCourseCreationId, handleValidationErrors, courseCreationController.getCourseCreationById)
  .put(validateCourseCreationId, validateCourseCreationUpdate, handleValidationErrors, courseCreationController.updateCourseCreation)
  .delete(validateCourseCreationId, handleValidationErrors, courseCreationController.deleteCourseCreation);

// Add this line near the top with other requires
const lessonRoutes = require('./lessonCreationRoutes');

// Add this line before module.exports
// Nested routes for lessons within course modules
router.use('/:courseId/modules/:moduleId/lessons', lessonRoutes);

module.exports = router;