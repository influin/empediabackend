const express = require('express');
const router = express.Router();
const ExperienceController = require('../controllers/experienceController');
const { protect, authorize } = require('../middleware/auth');
const { 
  validateExperience, 
  validateBulkExperience, 
  handleValidationErrors 
} = require('../middleware/experienceValidation');

// All routes require authentication
router.use(protect);

// Experience CRUD routes
router.route('/')
  .get(authorize('admin'), ExperienceController.getAllExperience)
  .post(validateExperience, handleValidationErrors, ExperienceController.createExperience);

// Bulk operations
router.post('/bulk', 
  validateBulkExperience, 
  handleValidationErrors, 
  ExperienceController.bulkCreateExperience
);

// User-specific experience routes
router.get('/user/:userId', ExperienceController.getUserExperience);
router.get('/my-experience', ExperienceController.getUserExperience);

// Individual experience routes
router.route('/:id')
  .get(ExperienceController.getExperienceById)
  .put(validateExperience, handleValidationErrors, ExperienceController.updateExperience)
  .delete(ExperienceController.deleteExperience);

module.exports = router;