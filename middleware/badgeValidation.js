const { body, param, query, validationResult } = require('express-validator');
const { BadgeCategories } = require('../models/Badge');

// Handle validation errors
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

// Badge creation validation
exports.validateCreateBadge = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Badge name must be between 2 and 100 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Badge description must be between 10 and 500 characters'),
  
  body('iconUrl')
    .isURL()
    .withMessage('Please provide a valid icon URL'),
  
  body('category')
    .isIn(Object.values(BadgeCategories))
    .withMessage(`Category must be one of: ${Object.values(BadgeCategories).join(', ')}`),
  
  body('userId')
    .isMongoId()
    .withMessage('Please provide a valid user ID'),
  
  body('progress')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Progress must be a non-negative integer'),
  
  body('target')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Target must be a positive integer'),
  
  body('requirements')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Requirements cannot exceed 1000 characters'),
  
  // Custom validation: progress should not exceed target
  body('progress').custom((progress, { req }) => {
    if (progress !== undefined && req.body.target !== undefined) {
      if (parseInt(progress) > parseInt(req.body.target)) {
        throw new Error('Progress cannot exceed target');
      }
    }
    return true;
  })
];

// Badge update validation
exports.validateUpdateBadge = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid badge ID'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Badge name must be between 2 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Badge description must be between 10 and 500 characters'),
  
  body('iconUrl')
    .optional()
    .isURL()
    .withMessage('Please provide a valid icon URL'),
  
  body('category')
    .optional()
    .isIn(Object.values(BadgeCategories))
    .withMessage(`Category must be one of: ${Object.values(BadgeCategories).join(', ')}`),
  
  body('progress')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Progress must be a non-negative integer'),
  
  body('target')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Target must be a positive integer'),
  
  body('requirements')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Requirements cannot exceed 1000 characters')
];

// Badge ID validation
exports.validateBadgeId = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid badge ID')
];

// User ID validation
exports.validateUserId = [
  param('userId')
    .isMongoId()
    .withMessage('Please provide a valid user ID')
];

// Progress update validation
exports.validateProgressUpdate = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid badge ID'),
  
  body('progress')
    .isInt({ min: 0 })
    .withMessage('Progress must be a non-negative integer')
];

// Query validation for filtering
exports.validateBadgeQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('category')
    .optional()
    .isIn(Object.values(BadgeCategories))
    .withMessage(`Category must be one of: ${Object.values(BadgeCategories).join(', ')}`),
  
  query('isEarned')
    .optional()
    .isBoolean()
    .withMessage('isEarned must be a boolean value'),
  
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('User ID must be a valid MongoDB ObjectId'),
  
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'earnedDate', 'category'])
    .withMessage('sortBy must be one of: createdAt, updatedAt, name, earnedDate, category'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be either asc or desc')
];