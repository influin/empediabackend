const express = require('express');
const router = express.Router();
const EducationController = require('../controllers/educationController');
const { protect } = require('../middleware/auth');
const { 
  validateEducation, 
  validateBulkEducation, 
  handleValidationErrors 
} = require('../middleware/educationValidation');

// All routes require authentication
router.use(protect);

// Education CRUD routes
router.route('/')
  .get(EducationController.getUserEducation) // GET /api/education - Get current user's education
  .post(
    validateEducation,
    handleValidationErrors,
    EducationController.createEducation
  ); // POST /api/education - Create education for current user

// Bulk operations
router.post('/bulk',
  validateBulkEducation,
  handleValidationErrors,
  EducationController.bulkCreateEducation
); // POST /api/education/bulk - Bulk create education

// User-specific education routes
router.route('/user/:userId')
  .get(EducationController.getUserEducation) // GET /api/education/user/:userId
  .post(
    validateEducation,
    handleValidationErrors,
    EducationController.createEducation
  ); // POST /api/education/user/:userId

// Bulk operations for specific user
router.post('/user/:userId/bulk',
  validateBulkEducation,
  handleValidationErrors,
  EducationController.bulkCreateEducation
);

// Individual education record routes
router.route('/:id')
  .get(EducationController.getEducationById) // GET /api/education/:id
  .put(
    validateEducation,
    handleValidationErrors,
    EducationController.updateEducation
  ) // PUT /api/education/:id
  .delete(EducationController.deleteEducation); // DELETE /api/education/:id

module.exports = router;