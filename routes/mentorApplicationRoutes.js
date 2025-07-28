const express = require('express');
const router = express.Router();
const MentorApplicationController = require('../controllers/mentorApplicationController');
const {
  validateCreateApplication,
  validateUpdateApplication,
  validateApplicationId,
  validateUserId,
  validateApplicationReview,
  validateQueryParams
} = require('../middleware/mentorApplicationValidation');

// GET /api/v1/mentor-applications - Get all mentor applications with filtering and pagination
router.get('/', validateQueryParams, MentorApplicationController.getAllApplications);

// GET /api/v1/mentor-applications/statistics - Get application statistics
router.get('/statistics', MentorApplicationController.getApplicationStatistics);

// GET /api/v1/mentor-applications/enums - Get application enums
router.get('/enums', MentorApplicationController.getApplicationEnums);

// GET /api/v1/mentor-applications/user/:userId - Get applications by user ID
router.get('/user/:userId', validateUserId, MentorApplicationController.getApplicationsByUserId);

// GET /api/v1/mentor-applications/:id - Get mentor application by ID
router.get('/:id', validateApplicationId, MentorApplicationController.getApplicationById);

// POST /api/v1/mentor-applications - Create new mentor application
router.post('/', validateCreateApplication, MentorApplicationController.createApplication);

// PUT /api/v1/mentor-applications/:id - Update mentor application
router.put('/:id', validateApplicationId, validateUpdateApplication, MentorApplicationController.updateApplication);

// PUT /api/v1/mentor-applications/:id/approve - Approve mentor application
router.put('/:id/approve', validateApplicationId, validateApplicationReview, MentorApplicationController.approveApplication);

// PUT /api/v1/mentor-applications/:id/reject - Reject mentor application
router.put('/:id/reject', validateApplicationId, validateApplicationReview, MentorApplicationController.rejectApplication);

// PUT /api/v1/mentor-applications/:id/waitlist - Move application to waitlist
router.put('/:id/waitlist', validateApplicationId, validateApplicationReview, MentorApplicationController.waitlistApplication);

// PUT /api/v1/mentor-applications/:id/under-review - Mark application as under review
router.put('/:id/under-review', validateApplicationId, validateApplicationReview, MentorApplicationController.markUnderReview);

// DELETE /api/v1/mentor-applications/:id - Delete mentor application (soft delete)
router.delete('/:id', validateApplicationId, MentorApplicationController.deleteApplication);

module.exports = router;