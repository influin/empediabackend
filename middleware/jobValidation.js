const { body, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Job creation validation (enhanced)
const validateJobCreation = [
  body('position')
    .trim()
    .notEmpty()
    .withMessage('Position is required')
    .isLength({ max: 100 })
    .withMessage('Position cannot exceed 100 characters'),
    
  body('company')
    .trim()
    .notEmpty()
    .withMessage('Company is required')
    .isLength({ max: 100 })
    .withMessage('Company name cannot exceed 100 characters'),
    
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Location is required'),
    
  body('logoUrl')
    .optional() // Made optional as per new model
    .trim()
    .isURL()
    .withMessage('Logo URL must be a valid URL'),
    
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required') // Now required
    .isLength({ max: 5000 })
    .withMessage('Description cannot exceed 5000 characters'),
    
  body('requirements')
    .optional()
    .isArray()
    .withMessage('Requirements must be an array'),
    
  body('requirements.*')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Each requirement cannot exceed 500 characters'),
    
  body('responsibilities')
    .optional()
    .isArray()
    .withMessage('Responsibilities must be an array'),
    
  body('responsibilities.*')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Each responsibility cannot exceed 500 characters'),
    
  body('salaryRange')
    .optional()
    .trim(),
    
  body('jobType')
    .notEmpty()
    .withMessage('Job type is required')
    .isIn(['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Temporary'])
    .withMessage('Invalid job type'),
    
  body('experienceLevel')
    .notEmpty()
    .withMessage('Experience level is required')
    .isIn(['Entry', 'Mid', 'Senior', 'Lead', 'Executive'])
    .withMessage('Invalid experience level'),
    
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
    
  body('skills.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each skill cannot exceed 50 characters'),
    
  body('applicationDeadline')
    .optional()
    .isISO8601()
    .withMessage('Application deadline must be a valid date')
    .custom((value, { req }) => {
      if (value && new Date(value) <= new Date()) {
        throw new Error('Application deadline must be in the future');
      }
      return true;
    }),
    
  body('isRemote')
    .optional()
    .isBoolean()
    .withMessage('isRemote must be a boolean'),

  // NEW VALIDATIONS
  body('budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget must be a positive number'),
    
  body('contactEmail')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Contact email must be a valid email address'),
    
  body('contactPhone')
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage('Contact phone must be a valid phone number'),
    
  body('benefits')
    .optional()
    .isArray()
    .withMessage('Benefits must be an array'),
    
  body('benefits.*')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Each benefit cannot exceed 100 characters'),
    
  body('workingHours')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Working hours cannot exceed 200 characters'),
    
  body('isUrgent')
    .optional()
    .isBoolean()
    .withMessage('isUrgent must be a boolean'),
    
  body('companyInfo')
    .optional()
    .isObject()
    .withMessage('Company info must be an object'),
    
  body('companyInfo.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Company name is required when company info is provided'),
    
  body('companyInfo.website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Company website must be a valid URL'),
    
  body('companyInfo.size')
    .optional()
    .isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
    .withMessage('Invalid company size'),
    
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
    
  handleValidationErrors
];

// Job update validation (enhanced)
const validateJobUpdate = [
  body('position')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Position cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Position cannot exceed 100 characters'),
    
  body('company')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Company cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Company name cannot exceed 100 characters'),
    
  body('location')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Location cannot be empty'),
    
  body('logoUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Logo URL must be a valid URL'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description cannot exceed 5000 characters'),
    
  body('jobType')
    .optional()
    .isIn(['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Temporary'])
    .withMessage('Invalid job type'),
    
  body('experienceLevel')
    .optional()
    .isIn(['Entry', 'Mid', 'Senior', 'Lead', 'Executive'])
    .withMessage('Invalid experience level'),
    
  body('applicationDeadline')
    .optional()
    .isISO8601()
    .withMessage('Application deadline must be a valid date'),
    
  body('isRemote')
    .optional()
    .isBoolean()
    .withMessage('isRemote must be a boolean'),

  // NEW UPDATE VALIDATIONS
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'active', 'paused', 'expired', 'rejected', 'closed'])
    .withMessage('Invalid status'),
    
  body('budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget must be a positive number'),
    
  body('contactEmail')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Contact email must be a valid email address'),
    
  body('contactPhone')
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage('Contact phone must be a valid phone number'),
    
  body('isUrgent')
    .optional()
    .isBoolean()
    .withMessage('isUrgent must be a boolean'),
    
  handleValidationErrors
];

// Query validation for job search (enhanced)
const validateJobQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
    
  query('jobType')
    .optional()
    .isIn(['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Temporary'])
    .withMessage('Invalid job type'),
    
  query('experienceLevel')
    .optional()
    .isIn(['Entry', 'Mid', 'Senior', 'Lead', 'Executive'])
    .withMessage('Invalid experience level'),
    
  query('isRemote')
    .optional()
    .isBoolean()
    .withMessage('isRemote must be a boolean'),

  // NEW QUERY VALIDATIONS
  query('status')
    .optional()
    .isIn(['pending', 'approved', 'active', 'paused', 'expired', 'rejected', 'closed'])
    .withMessage('Invalid status'),
    
  query('isUrgent')
    .optional()
    .isBoolean()
    .withMessage('isUrgent must be a boolean'),
    
  query('minBudget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum budget must be a positive number'),
    
  query('maxBudget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum budget must be a positive number'),
    
  query('postedWithin')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Posted within must be between 1 and 365 days'),
    
  query('sortBy')
    .optional()
    .isIn(['postedDate', 'views', 'applicationCount', 'position', 'company', 'budget'])
    .withMessage('Invalid sort field'),
    
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
    
  handleValidationErrors
];

// NEW: Status update validation
const validateStatusUpdate = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'approved', 'active', 'paused', 'expired', 'rejected', 'closed'])
    .withMessage('Invalid status'),
    
  handleValidationErrors
];

module.exports = {
  validateJobCreation,
  validateJobUpdate,
  validateJobQuery,
  validateStatusUpdate, // NEW
  handleValidationErrors
};