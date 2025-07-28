const express = require('express');
const router = express.Router();
const BadgeController = require('../controllers/badgeController');
const {
  validateCreateBadge,
  validateUpdateBadge,
  validateBadgeId,
  validateUserId,
  validateProgressUpdate,
  validateBadgeQuery,
  handleValidationErrors
} = require('../middleware/badgeValidation');

// GET /api/v1/badges - Get all badges with filtering and pagination
router.get('/', 
  validateBadgeQuery,
  handleValidationErrors,
  BadgeController.getAllBadges
);

// GET /api/v1/badges/categories - Get badge categories
router.get('/categories', BadgeController.getBadgeCategories);

// GET /api/v1/badges/:id - Get badge by ID
router.get('/:id', 
  validateBadgeId,
  handleValidationErrors,
  BadgeController.getBadgeById
);

// POST /api/v1/badges - Create new badge
router.post('/', 
  validateCreateBadge,
  handleValidationErrors,
  BadgeController.createBadge
);

// PUT /api/v1/badges/:id - Update badge
router.put('/:id', 
  validateUpdateBadge,
  handleValidationErrors,
  BadgeController.updateBadge
);

// DELETE /api/v1/badges/:id - Delete badge (soft delete)
router.delete('/:id', 
  validateBadgeId,
  handleValidationErrors,
  BadgeController.deleteBadge
);

// GET /api/v1/badges/user/:userId - Get badges by user ID
router.get('/user/:userId', 
  validateUserId,
  handleValidationErrors,
  BadgeController.getBadgesByUserId
);

// PUT /api/v1/badges/:id/earn - Mark badge as earned
router.put('/:id/earn', 
  validateBadgeId,
  handleValidationErrors,
  BadgeController.markBadgeAsEarned
);

// PUT /api/v1/badges/:id/progress - Update badge progress
router.put('/:id/progress', 
  validateProgressUpdate,
  handleValidationErrors,
  BadgeController.updateBadgeProgress
);

// GET /api/v1/badges/user/:userId/statistics - Get badge statistics for user
router.get('/user/:userId/statistics', 
  validateUserId,
  handleValidationErrors,
  BadgeController.getBadgeStatistics
);

module.exports = router;