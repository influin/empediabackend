const express = require('express');
const router = express.Router();
const AchievementController = require('../controllers/achievementController');
const { protect, authorize } = require('../middleware/auth');
const { 
  validateAchievement, 
  validateBulkAchievements, 
  handleValidationErrors 
} = require('../middleware/achievementValidation');

// All routes require authentication
router.use(protect);

// Achievement CRUD routes
router.route('/')
  .get(authorize('admin'), AchievementController.getAllAchievements)
  .post(validateAchievement, handleValidationErrors, AchievementController.createAchievement);

// Bulk operations
router.post('/bulk', 
  validateBulkAchievements, 
  handleValidationErrors, 
  AchievementController.bulkCreateAchievements
);

// User-specific achievement routes
router.get('/user/:userId', AchievementController.getUserAchievements);
router.get('/my-achievements', AchievementController.getUserAchievements);
router.get('/stats/:userId?', AchievementController.getAchievementStats);

// Admin verification routes
router.patch('/:id/verify', authorize('admin'), AchievementController.verifyAchievement);

// Individual achievement routes
router.route('/:id')
  .get(AchievementController.getAchievementById)
  .put(validateAchievement, handleValidationErrors, AchievementController.updateAchievement)
  .delete(AchievementController.deleteAchievement);

module.exports = router;