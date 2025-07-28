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

// Certification creation/update validation
exports.validateCertification = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Certification name must be between 2 and 200 characters'),
  
  body('issuer')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Issuer must be between 2 and 200 characters'),
  
  body('credentialId')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Credential ID cannot exceed 100 characters'),
  
  body('issueDate')
    .optional()
    .isISO8601()
    .withMessage('Issue date must be a valid date')
    .custom((value) => {
      if (value && new Date(value) > new Date()) {
        throw new Error('Issue date cannot be in the future');
      }
      return true;
    }),
  
  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Expiry date must be a valid date')
    .custom((value, { req }) => {
      if (req.body.doesNotExpire && value) {
        throw new Error('Expiry date cannot be set if certification does not expire');
      }
      if (value && req.body.issueDate && new Date(value) <= new Date(req.body.issueDate)) {
        throw new Error('Expiry date must be after issue date');
      }
      return true;
    }),
  
  body('credentialUrl')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Credential URL must be a valid HTTP/HTTPS URL'),
  
  body('doesNotExpire')
    .optional()
    .isBoolean()
    .withMessage('doesNotExpire must be a boolean'),
  
  body('category')
    .optional()
    .isIn(['technical', 'professional', 'academic', 'industry', 'vendor', 'other'])
    .withMessage('Category must be one of: technical, professional, academic, industry, vendor, other'),
  
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

// Bulk certification creation validation
exports.validateBulkCertifications = [
  body('certifications')
    .isArray({ min: 1, max: 10 })
    .withMessage('Certifications must be an array with 1-10 items'),
  
  body('certifications.*.name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Certification name must be between 2 and 200 characters'),
  
  body('certifications.*.issuer')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Issuer must be between 2 and 200 characters'),
  
  body('certifications.*.credentialId')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Credential ID cannot exceed 100 characters'),
  
  body('certifications.*.issueDate')
    .optional()
    .isISO8601()
    .withMessage('Issue date must be a valid date'),
  
  body('certifications.*.expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Expiry date must be a valid date'),
  
  body('certifications.*.credentialUrl')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Credential URL must be a valid HTTP/HTTPS URL'),
  
  body('certifications.*.doesNotExpire')
    .optional()
    .isBoolean()
    .withMessage('doesNotExpire must be a boolean'),
  
  body('certifications.*.category')
    .optional()
    .isIn(['technical', 'professional', 'academic', 'industry', 'vendor', 'other'])
    .withMessage('Category must be one of: technical, professional, academic, industry, vendor, other')
];