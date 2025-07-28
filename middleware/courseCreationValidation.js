const { body, query, param, validationResult } = require('express-validator');

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

const validateCourseCreationCreation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  
  body('category')
    .notEmpty()
    .withMessage('Category is required'),
  
  body('subcategory')
    .notEmpty()
    .withMessage('Subcategory is required'),
  
  body('level')
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Level must be beginner, intermediate, or advanced'),
  
  body('language')
    .notEmpty()
    .withMessage('Language is required'),
  
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('isFree')
    .optional()
    .isBoolean()
    .withMessage('isFree must be a boolean'),
  
  body('estimatedDuration')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Estimated duration must be a positive integer'),
  
  body('learningObjectives')
    .optional()
    .isArray()
    .withMessage('Learning objectives must be an array'),
  
  body('prerequisites')
    .optional()
    .isArray()
    .withMessage('Prerequisites must be an array'),
  
  body('targetAudience')
    .optional()
    .isArray()
    .withMessage('Target audience must be an array'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('resources')
    .optional()
    .isArray()
    .withMessage('Resources must be an array'),
  
  body('instructorCredentials')
    .optional()
    .isArray()
    .withMessage('Instructor credentials must be an array'),
  
  body('modules')
    .optional()
    .isArray()
    .withMessage('Modules must be an array'),
  
  body('modules.*.title')
    .optional()
    .notEmpty()
    .withMessage('Module title is required'),
  
  body('modules.*.description')
    .optional()
    .notEmpty()
    .withMessage('Module description is required'),
  
  body('modules.*.order')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Module order must be a positive integer'),
  
  body('provideCertificate')
    .optional()
    .isBoolean()
    .withMessage('Provide certificate must be a boolean'),
  
  body('allowDiscussions')
    .optional()
    .isBoolean()
    .withMessage('Allow discussions must be a boolean'),
  
  body('allowDownloads')
    .optional()
    .isBoolean()
    .withMessage('Allow downloads must be a boolean')
];

const validateCourseCreationUpdate = [
  body('title')
    .optional()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('description')
    .optional()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  
  body('level')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Level must be beginner, intermediate, or advanced'),
  
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('isFree')
    .optional()
    .isBoolean()
    .withMessage('isFree must be a boolean'),
  
  body('estimatedDuration')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Estimated duration must be a positive integer'),
  
  body('learningObjectives')
    .optional()
    .isArray()
    .withMessage('Learning objectives must be an array'),
  
  body('prerequisites')
    .optional()
    .isArray()
    .withMessage('Prerequisites must be an array'),
  
  body('targetAudience')
    .optional()
    .isArray()
    .withMessage('Target audience must be an array'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('resources')
    .optional()
    .isArray()
    .withMessage('Resources must be an array'),
  
  body('instructorCredentials')
    .optional()
    .isArray()
    .withMessage('Instructor credentials must be an array'),
  
  body('modules')
    .optional()
    .isArray()
    .withMessage('Modules must be an array'),
  
  body('provideCertificate')
    .optional()
    .isBoolean()
    .withMessage('Provide certificate must be a boolean'),
  
  body('allowDiscussions')
    .optional()
    .isBoolean()
    .withMessage('Allow discussions must be a boolean'),
  
  body('allowDownloads')
    .optional()
    .isBoolean()
    .withMessage('Allow downloads must be a boolean')
];

const validateCourseCreationQuery = [
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
    .isIn(['draft', 'submitted', 'under_review', 'approved', 'rejected', 'published'])
    .withMessage('Invalid status'),
  
  query('category')
    .optional()
    .notEmpty()
    .withMessage('Category cannot be empty'),
  
  query('creatorId')
    .optional()
    .isMongoId()
    .withMessage('Creator ID must be a valid MongoDB ObjectId')
];

const validateReviewAction = [
  body('action')
    .isIn(['approve', 'reject'])
    .withMessage('Action must be approve or reject'),
  
  body('rejectionReason')
    .if(body('action').equals('reject'))
    .notEmpty()
    .withMessage('Rejection reason is required when rejecting')
];

const validateCourseCreationId = [
  param('id')
    .isMongoId()
    .withMessage('Course creation ID must be a valid MongoDB ObjectId')
];

module.exports = {
  validateCourseCreationCreation,
  validateCourseCreationUpdate,
  validateCourseCreationQuery,
  validateReviewAction,
  validateCourseCreationId,
  handleValidationErrors
};