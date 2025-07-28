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

// Experience creation/update validation
exports.validateExperience = [
  body('company')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Company name must be between 2 and 200 characters'),
  
  body('position')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Position must be between 2 and 100 characters'),
  
  body('duration')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Duration must be between 1 and 50 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (value && req.body.startDate && new Date(value) < new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  body('isCurrentlyWorking')
    .optional()
    .isBoolean()
    .withMessage('isCurrentlyWorking must be a boolean'),
  
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters'),
  
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array')
    .custom((skills) => {
      if (skills.length > 20) {
        throw new Error('Cannot have more than 20 skills');
      }
      
      for (const skill of skills) {
        if (typeof skill !== 'string' || skill.trim().length === 0) {
          throw new Error('Each skill must be a non-empty string');
        }
        if (skill.length > 50) {
          throw new Error('Each skill cannot exceed 50 characters');
        }
      }
      
      return true;
    })
];

// Bulk experience creation validation
exports.validateBulkExperience = [
  body('experiences')
    .isArray({ min: 1, max: 10 })
    .withMessage('Experiences must be an array with 1-10 items'),
  
  body('experiences.*.company')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Company name must be between 2 and 200 characters'),
  
  body('experiences.*.position')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Position must be between 2 and 100 characters'),
  
  body('experiences.*.duration')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Duration must be between 1 and 50 characters'),
  
  body('experiences.*.description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('experiences.*.startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  body('experiences.*.endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  body('experiences.*.isCurrentlyWorking')
    .optional()
    .isBoolean()
    .withMessage('isCurrentlyWorking must be a boolean'),
  
  body('experiences.*.location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters'),
  
  body('experiences.*.skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array')
];