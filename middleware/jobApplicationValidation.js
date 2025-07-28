const { body, query, param, validationResult } = require('express-validator');

// Validation for creating job application
exports.validateJobApplicationCreation = [
  body('jobId')
    .notEmpty()
    .withMessage('Job ID is required')
    .isMongoId()
    .withMessage('Invalid job ID format'),
  
  body('resumeUrl')
    .optional()
    .isURL()
    .withMessage('Resume URL must be a valid URL'),
  
  body('coverLetter')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Cover letter must not exceed 2000 characters'),
  
  body('portfolioUrl')
    .optional()
    .isURL()
    .withMessage('Portfolio URL must be a valid URL'),
  
  body('linkedinUrl')
    .optional()
    .isURL()
    .withMessage('LinkedIn URL must be a valid URL'),
  
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  
  body('attachments.*')
    .optional()
    .isURL()
    .withMessage('Each attachment must be a valid URL'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

// Validation for updating job application
exports.validateJobApplicationUpdate = [
  body('resumeUrl')
    .optional()
    .isURL()
    .withMessage('Resume URL must be a valid URL'),
  
  body('coverLetter')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Cover letter must not exceed 2000 characters'),
  
  body('portfolioUrl')
    .optional()
    .isURL()
    .withMessage('Portfolio URL must be a valid URL'),
  
  body('linkedinUrl')
    .optional()
    .isURL()
    .withMessage('LinkedIn URL must be a valid URL'),
  
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

// Validation for status update
exports.validateStatusUpdate = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['submitted', 'underReview', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn'])
    .withMessage('Invalid status value'),
  
  body('reviewerNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Reviewer notes must not exceed 1000 characters'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

// Validation for interview scheduling
exports.validateInterviewScheduling = [
  body('interviewDate')
    .notEmpty()
    .withMessage('Interview date is required')
    .isISO8601()
    .withMessage('Interview date must be a valid date')
    .custom(value => {
      if (new Date(value) <= new Date()) {
        throw new Error('Interview date must be in the future');
      }
      return true;
    }),
  
  body('interviewNotes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Interview notes must not exceed 500 characters'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

// Validation for query parameters
exports.validateJobApplicationQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['submitted', 'underReview', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn'])
    .withMessage('Invalid status value'),
  
  query('sortBy')
    .optional()
    .isIn(['appliedAt', 'status', 'company', 'jobTitle'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];