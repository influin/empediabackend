const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('./validation');

// Validation for creating mentor application
const validateCreateApplication = [
  body('applicantId')
    .notEmpty()
    .withMessage('Applicant ID is required')
    .isMongoId()
    .withMessage('Invalid applicant ID format'),
    
  // Professional Information
  body('currentPosition')
    .notEmpty()
    .withMessage('Current position is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Position must be between 2 and 200 characters')
    .trim(),
    
  body('company')
    .notEmpty()
    .withMessage('Company is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Company name must be between 2 and 200 characters')
    .trim(),
    
  body('experienceYears')
    .isInt({ min: 0, max: 50 })
    .withMessage('Experience years must be between 0 and 50'),
    
  body('expertise')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Expertise must be an array with maximum 20 items'),
    
  body('skills')
    .optional()
    .isArray({ max: 30 })
    .withMessage('Skills must be an array with maximum 30 items'),
    
  // Mentorship Information
  body('bio')
    .notEmpty()
    .withMessage('Bio is required')
    .isLength({ min: 50, max: 2000 })
    .withMessage('Bio must be between 50 and 2000 characters')
    .trim(),
    
  body('mentorshipApproach')
    .notEmpty()
    .withMessage('Mentorship approach is required')
    .isLength({ min: 50, max: 1000 })
    .withMessage('Mentorship approach must be between 50 and 1000 characters')
    .trim(),
    
  // Professional Links
  body('linkedinUrl')
    .notEmpty()
    .withMessage('LinkedIn URL is required')
    .matches(/^https?:\/\/(www\.)?linkedin\.com\/.+/)
    .withMessage('Please provide a valid LinkedIn URL'),
    
  body('portfolioUrl')
    .optional()
    .isURL()
    .withMessage('Portfolio URL must be a valid URL'),
    
  body('resumeUrl')
    .optional()
    .isURL()
    .withMessage('Resume URL must be a valid URL'),
    
  // Availability Information
  body('languages')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Languages must be an array with maximum 10 items'),
    
  body('timezone')
    .notEmpty()
    .withMessage('Timezone is required')
    .trim(),
    
  body('availableSessionTypes')
    .isArray({ min: 1 })
    .withMessage('At least one session type must be provided'),
    
  body('availableSessionTypes.*.type')
    .isIn(['1:1 Video Call', 'Mock Interview', 'Document Review', 'Text Consultation'])
    .withMessage('Invalid session type'),
    
  body('availableSessionTypes.*.duration')
    .isIn(['30min', '60min', '90min', '120min'])
    .withMessage('Invalid session duration'),
    
  body('availableSessionTypes.*.price')
    .isFloat({ min: 0 })
    .withMessage('Session price must be a positive number'),
    
  // Additional Information
  body('certifications')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Certifications must be an array with maximum 20 items'),
    
  body('education')
    .optional()
    .isArray()
    .withMessage('Education must be an array'),
    
  body('workExperience')
    .optional()
    .isArray()
    .withMessage('Work experience must be an array'),
    
  body('agreedToTerms')
    .equals('true')
    .withMessage('Must agree to terms and conditions'),
    
  body('additionalNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Additional notes cannot exceed 1000 characters')
    .trim(),
    
  handleValidationErrors
];

// Validation for updating mentor application (removed applicant details)
const validateUpdateApplication = [
  body('currentPosition')
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage('Position must be between 2 and 200 characters')
    .trim(),
    
  body('company')
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage('Company name must be between 2 and 200 characters')
    .trim(),
    
  body('experienceYears')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Experience years must be between 0 and 50'),
    
  body('expertise')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Expertise must be an array with maximum 20 items'),
    
  body('skills')
    .optional()
    .isArray({ max: 30 })
    .withMessage('Skills must be an array with maximum 30 items'),
    
  body('bio')
    .optional()
    .isLength({ min: 50, max: 2000 })
    .withMessage('Bio must be between 50 and 2000 characters')
    .trim(),
    
  body('mentorshipApproach')
    .optional()
    .isLength({ min: 50, max: 1000 })
    .withMessage('Mentorship approach must be between 50 and 1000 characters')
    .trim(),
    
  body('linkedinUrl')
    .optional()
    .matches(/^https?:\/\/(www\.)?linkedin\.com\/.+/)
    .withMessage('Please provide a valid LinkedIn URL'),
    
  body('portfolioUrl')
    .optional()
    .isURL()
    .withMessage('Portfolio URL must be a valid URL'),
    
  body('resumeUrl')
    .optional()
    .isURL()
    .withMessage('Resume URL must be a valid URL'),
    
  body('languages')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Languages must be an array with maximum 10 items'),
    
  body('timezone')
    .optional()
    .trim(),
    
  body('availableSessionTypes')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one session type must be provided'),
    
  body('additionalNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Additional notes cannot exceed 1000 characters')
    .trim(),
    
  handleValidationErrors
];

// Validation for application ID parameter
const validateApplicationId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid application ID format'),
  handleValidationErrors
];

// Validation for user ID parameter
const validateUserId = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  handleValidationErrors
];

// Validation for application review
const validateApplicationReview = [
  body('reviewerId')
    .notEmpty()
    .withMessage('Reviewer ID is required')
    .isMongoId()
    .withMessage('Invalid reviewer ID format'),
    
  body('rejectionReason')
    .optional()
    .isLength({ min: 10, max: 500 })
    .withMessage('Rejection reason must be between 10 and 500 characters')
    .trim(),
    
  body('reason')
    .optional()
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters')
    .trim(),
    
  handleValidationErrors
];

// Validation for query parameters
const validateQueryParams = [
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
    .isIn(['pending', 'underReview', 'approved', 'rejected', 'waitlisted'])
    .withMessage('Invalid status value'),
    
  query('sortBy')
    .optional()
    .isIn(['submittedAt', 'reviewedAt', 'applicantName', 'experienceYears', 'status'])
    .withMessage('Invalid sortBy field'),
    
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
    
  query('experienceYears')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Experience years must be between 0 and 50'),
    
  handleValidationErrors
];

module.exports = {
  validateCreateApplication,
  validateUpdateApplication,
  validateApplicationId,
  validateUserId,
  validateApplicationReview,
  validateQueryParams
};