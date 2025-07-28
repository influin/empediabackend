const express = require('express');
const router = express.Router();
const JobController = require('../controllers/jobController');
const { protect, optionalAuth, authorize } = require('../middleware/auth');
const { 
  validateJobCreation, 
  validateJobUpdate, 
  validateJobQuery,
  validateStatusUpdate // NEW
} = require('../middleware/jobValidation');

// Public routes
router.get('/', validateJobQuery, optionalAuth, JobController.getAllJobs);
router.get('/stats', JobController.getJobStats);
router.get('/urgent', JobController.getUrgentJobs); // NEW
router.get('/:id', optionalAuth, JobController.getJobById);

// Protected routes (require authentication)
router.use(protect);

// Job management
router.post('/', validateJobCreation, JobController.createJob);
router.put('/:id', validateJobUpdate, JobController.updateJob);
router.delete('/:id', JobController.deleteJob);

// NEW: Job status management routes
router.patch('/:id/activate', JobController.activateJob);
router.patch('/:id/pause', JobController.pauseJob);
router.patch('/:id/close', JobController.closeJob);

// Job interactions
router.post('/:id/bookmark', JobController.toggleBookmark);
router.post('/:id/apply', JobController.applyForJob);

// User-specific job routes
router.get('/user/bookmarked', JobController.getBookmarkedJobs);
router.get('/user/applied', JobController.getAppliedJobs);
router.get('/user/posted', JobController.getMyJobs);
router.get('/user/recommended', JobController.getRecommendedJobs);

// NEW: Admin-only routes
router.get('/admin/pending', authorize('admin'), JobController.getPendingJobs);
router.patch('/:id/approve', authorize('admin'), JobController.approveJob);
router.patch('/:id/reject', authorize('admin'), JobController.rejectJob);

module.exports = router;