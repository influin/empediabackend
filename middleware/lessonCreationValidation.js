const { body, query, param, validationResult } = require('express-validator');
const { LessonType } = require('../models/CourseModuleCreation');

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

const validateLessonCreation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('type')
    .isIn(Object.values(LessonType))
    .withMessage(`Type must be one of: ${Object.values(LessonType).join(', ')}`),
  
  body('order')
    .isInt({ min: 1 })
    .withMessage('Order must be a positive integer'),
  
  body('videoUrl')
    .optional()
    .isURL()
    .withMessage('Video URL must be a valid URL'),
  
  body('textContent')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('Text content cannot exceed 10000 characters'),
  
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  
  body('attachments.*')
    .optional()
    .isURL()
    .withMessage('Each attachment must be a valid URL'),
  
  body('duration')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration must be a non-negative integer'),
  
  body('isPreview')
    .optional()
    .isBoolean()
    .withMessage('isPreview must be a boolean'),
  
  body('isPublished')
    .optional()
    .isBoolean()
    .withMessage('isPublished must be a boolean'),
  
  body('quizzes')
    .optional()
    .isArray()
    .withMessage('Quizzes must be an array'),
  
  body('quizzes.*.question')
    .optional()
    .notEmpty()
    .withMessage('Quiz question is required'),
  
  body('quizzes.*.options')
    .optional()
    .isArray({ min: 2 })
    .withMessage('Quiz must have at least 2 options'),
  
  body('quizzes.*.correctAnswerIndex')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Correct answer index must be a non-negative integer'),
  
  body('quizzes.*.explanation')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Quiz explanation cannot exceed 500 characters')
];

const validateLessonUpdate = [
  body('title')
    .optional()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('type')
    .optional()
    .isIn(Object.values(LessonType))
    .withMessage(`Type must be one of: ${Object.values(LessonType).join(', ')}`),
  
  body('order')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Order must be a positive integer'),
  
  body('videoUrl')
    .optional()
    .isURL()
    .withMessage('Video URL must be a valid URL'),
  
  body('textContent')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('Text content cannot exceed 10000 characters'),
  
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  
  body('duration')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration must be a non-negative integer'),
  
  body('isPreview')
    .optional()
    .isBoolean()
    .withMessage('isPreview must be a boolean'),
  
  body('isPublished')
    .optional()
    .isBoolean()
    .withMessage('isPublished must be a boolean'),
  
  body('quizzes')
    .optional()
    .isArray()
    .withMessage('Quizzes must be an array')
];

const validateQuizCreation = [
  body('question')
    .notEmpty()
    .withMessage('Question is required')
    .isLength({ min: 5, max: 500 })
    .withMessage('Question must be between 5 and 500 characters'),
  
  body('options')
    .isArray({ min: 2, max: 6 })
    .withMessage('Quiz must have between 2 and 6 options'),
  
  body('options.*')
    .notEmpty()
    .withMessage('Each option must not be empty')
    .isLength({ max: 200 })
    .withMessage('Each option cannot exceed 200 characters'),
  
  body('correctAnswerIndex')
    .isInt({ min: 0 })
    .withMessage('Correct answer index must be a non-negative integer')
    .custom((value, { req }) => {
      if (req.body.options && value >= req.body.options.length) {
        throw new Error('Correct answer index must be within options range');
      }
      return true;
    }),
  
  body('explanation')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Explanation cannot exceed 500 characters')
];

const validateLessonQuery = [
  query('type')
    .optional()
    .isIn(Object.values(LessonType))
    .withMessage(`Type must be one of: ${Object.values(LessonType).join(', ')}`),
  
  query('isPublished')
    .optional()
    .isBoolean()
    .withMessage('isPublished must be a boolean'),
  
  query('isPreview')
    .optional()
    .isBoolean()
    .withMessage('isPreview must be a boolean')
];

const validateLessonId = [
  param('lessonId')
    .isMongoId()
    .withMessage('Lesson ID must be a valid MongoDB ObjectId')
];

const validateModuleId = [
  param('moduleId')
    .isMongoId()
    .withMessage('Module ID must be a valid MongoDB ObjectId')
];

const validateCourseId = [
  param('courseId')
    .isMongoId()
    .withMessage('Course ID must be a valid MongoDB ObjectId')
];

module.exports = {
  validateLessonCreation,
  validateLessonUpdate,
  validateQuizCreation,
  validateLessonQuery,
  validateLessonId,
  validateModuleId,
  validateCourseId,
  handleValidationErrors
};