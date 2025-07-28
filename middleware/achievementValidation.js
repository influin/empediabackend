const { body, validationResult } = require('express-validator');

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

// Achievement creation/update validation
exports.validateAchievement = [
  body('title')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Title must be between 2 and 200 characters'),
  
  body('issuer')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Issuer must be between 2 and 200 characters'),
  
  body('date')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Date must be between 1 and 50 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('imageUrl')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Image URL must be a valid HTTP/HTTPS URL'),
  
  body('achievementDate')
    .optional()
    .isISO8601()
    .withMessage('Achievement date must be a valid date')
    .custom((value) => {
      if (value && new Date(value) > new Date()) {
        throw new Error('Achievement date cannot be in the future');
      }
      return true;
    }),
  
  body('category')
    .optional()
    .isIn(['academic', 'professional', 'certification', 'award', 'competition', 'volunteer', 'other'])
    .withMessage('Category must be one of: academic, professional, certification, award, competition, volunteer, other'),
  
  body('verificationUrl')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Verification URL must be a valid HTTP/HTTPS URL')
];

// Bulk achievement creation validation
exports.validateBulkAchievements = [
  body('achievements')
    .isArray({ min: 1, max: 10 })
    .withMessage('Achievements must be an array with 1-10 items'),
  
  body('achievements.*.title')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Title must be between 2 and 200 characters'),
  
  body('achievements.*.issuer')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Issuer must be between 2 and 200 characters'),
  
  body('achievements.*.date')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Date must be between 1 and 50 characters'),
  
  body('achievements.*.description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('achievements.*.imageUrl')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Image URL must be a valid HTTP/HTTPS URL'),
  
  body('achievements.*.achievementDate')
    .optional()
    .isISO8601()
    .withMessage('Achievement date must be a valid date'),
  
  body('achievements.*.category')
    .optional()
    .isIn(['academic', 'professional', 'certification', 'award', 'competition', 'volunteer', 'other'])
    .withMessage('Category must be one of: academic, professional, certification, award, competition, volunteer, other'),
  
  body('achievements.*.verificationUrl')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Verification URL must be a valid HTTP/HTTPS URL')
];