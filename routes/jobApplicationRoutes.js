const express = require('express');
const router = express.Router();
const jobApplicationController = require('../controllers/jobApplicationController');
const { protect, authorize } = require('../middleware/auth');
const {
  validateJobApplicationCreation,
  validateJobApplicationUpdate,
  validateStatusUpdate,
  validateInterviewScheduling,
  validateJobApplicationQuery
} = require('../middleware/jobApplicationValidation');

// All routes require authentication
router.use(protect);

// Job Application CRUD routes
router.route('/')
  .get(authorize('admin'), jobApplicationController.getAllJobApplications)
  .post(validateJobApplicationCreation, jobApplicationController.createJobApplication);

// Get applications for a specific job
router.get('/job/:jobId', 
  validateJobApplicationQuery,
  jobApplicationController.getJobApplications
);

// Get user's applications
router.get('/user/:userId', jobApplicationController.getUserApplications);
router.get('/my-applications', jobApplicationController.getUserApplications);

// Status management routes
router.put('/:id/status', 
  validateStatusUpdate,
  jobApplicationController.updateApplicationStatus
);

// Interview scheduling
router.put('/:id/schedule-interview', 
  validateInterviewScheduling,
  jobApplicationController.scheduleInterview
);

// Withdraw application
router.put('/:id/withdraw', jobApplicationController.withdrawApplication);

// Statistics and admin routes
router.get('/stats/overview', jobApplicationController.getApplicationStats);
router.get('/admin/pending', authorize('admin'), jobApplicationController.getPendingApplications);
router.get('/interviews/upcoming', jobApplicationController.getUpcomingInterviews);

// Individual job application routes
router.route('/:id')
  .get(jobApplicationController.getJobApplicationById)
  .put(validateJobApplicationUpdate, jobApplicationController.updateJobApplication)
  .delete(jobApplicationController.deleteJobApplication);

module.exports = router;