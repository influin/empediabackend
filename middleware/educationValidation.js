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

// Education creation/update validation
exports.validateEducation = [
  body('school')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('School name must be between 2 and 200 characters'),
  
  body('degree')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Degree must be between 2 and 100 characters'),
  
  body('field')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Field of study must be between 2 and 100 characters'),
  
  body('duration')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Duration must be between 1 and 50 characters'),
  
  body('grade')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Grade cannot exceed 20 characters'),
  
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
  
  body('isCurrentlyStudying')
    .optional()
    .isBoolean()
    .withMessage('Currently studying must be a boolean'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('achievements')
    .optional()
    .isArray()
    .withMessage('Achievements must be an array'),
  
  body('achievements.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Each achievement must be between 1 and 200 characters'),
  
  body('gpa')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('GPA must be a number between 0 and 10')
];

// Bulk education validation
exports.validateBulkEducation = [
  body('educationRecords')
    .isArray({ min: 1 })
    .withMessage('Education records array is required and must not be empty'),
  
  body('educationRecords.*.school')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('School name must be between 2 and 200 characters'),
  
  body('educationRecords.*.degree')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Degree must be between 2 and 100 characters'),
  
  body('educationRecords.*.field')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Field of study must be between 2 and 100 characters'),
  
  body('educationRecords.*.duration')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Duration must be between 1 and 50 characters')
];