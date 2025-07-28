const { body, query, validationResult } = require('express-validator');

// Validation for course creation
exports.validateCourseCreation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  
  body('instructor')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Instructor name cannot exceed 100 characters'),
  
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  
  body('rating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Rating must be between 0 and 5'),
  
  body('reviewCount')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Review count must be a non-negative integer'),
  
  body('level')
    .optional()
    .isIn(['Beginner', 'Intermediate', 'Advanced'])
    .withMessage('Level must be Beginner, Intermediate, or Advanced'),
  
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
  
  body('isFree')
    .optional()
    .isBoolean()
    .withMessage('isFree must be a boolean'),
  
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  
  body('skills.*')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each skill must be a string between 1 and 50 characters'),
  
  body('category')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Category cannot exceed 50 characters'),
  
  body('modules')
    .optional()
    .isArray()
    .withMessage('Modules must be an array'),
  
  body('modules.*.title')
    .optional()
    .notEmpty()
    .withMessage('Module title is required'),
  
  body('modules.*.lessons')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Module lessons must be a non-negative integer')
];

// Validation for course update
exports.validateCourseUpdate = [
  body('title')
    .optional()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  
  body('instructor')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Instructor name cannot exceed 100 characters'),
  
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  
  body('rating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Rating must be between 0 and 5'),
  
  body('level')
    .optional()
    .isIn(['Beginner', 'Intermediate', 'Advanced'])
    .withMessage('Level must be Beginner, Intermediate, or Advanced'),
  
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
  
  body('isFree')
    .optional()
    .isBoolean()
    .withMessage('isFree must be a boolean')
];

// Validation for progress update
exports.validateProgressUpdate = [
  body('progress')
    .notEmpty()
    .withMessage('Progress is required')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100')
];

// Validation for course query parameters
exports.validateCourseQuery = [
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
    .isLength({ max: 50 })
    .withMessage('Category cannot exceed 50 characters'),
  
  query('level')
    .optional()
    .isIn(['Beginner', 'Intermediate', 'Advanced'])
    .withMessage('Level must be Beginner, Intermediate, or Advanced'),
  
  query('isFree')
    .optional()
    .isBoolean()
    .withMessage('isFree must be a boolean'),
  
  query('minRating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Minimum rating must be between 0 and 5'),
  
  query('sortBy')
    .optional()
    .isIn(['title', 'createdAt', 'rating', 'price'])
    .withMessage('Sort by must be title, createdAt, rating, or price'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Handle validation errors
exports.handleValidationErrors = (req, res, next) => {
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