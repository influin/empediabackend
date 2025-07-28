const { body, param, query, validationResult } = require('express-validator');
const { BookingStatuses, SessionTypes, Durations } = require('../models/Booking');

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

// Booking creation validation
exports.validateCreateBooking = [
  body('mentorId')
    .isMongoId()
    .withMessage('Please provide a valid mentor ID'),
  
  body('userId')
    .isMongoId()
    .withMessage('Please provide a valid user ID'),
  
  body('mentorName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Mentor name must be between 2 and 100 characters'),
  
  body('mentorPosition')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Mentor position must be between 2 and 200 characters'),
  
  body('mentorImage')
    .isURL()
    .withMessage('Please provide a valid mentor image URL'),
  
  body('sessionType')
    .isIn(Object.values(SessionTypes))
    .withMessage(`Session type must be one of: ${Object.values(SessionTypes).join(', ')}`),
  
  body('duration')
    .isIn(Object.values(Durations))
    .withMessage(`Duration must be one of: ${Object.values(Durations).join(', ')}`),
  
  body('date')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format')
    .custom((date) => {
      const bookingDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (bookingDate < today) {
        throw new Error('Booking date cannot be in the past');
      }
      return true;
    }),
  
  body('time')
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('Time must be in HH:MM format'),
  
  body('topic')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Topic must be between 5 and 500 characters'),
  
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  
  // Custom validation for date and time combination
  body('time').custom((time, { req }) => {
    const date = req.body.date;
    if (date && time) {
      const bookingDateTime = new Date(`${date}T${time}:00`);
      const now = new Date();
      
      if (bookingDateTime <= now) {
        throw new Error('Booking date and time must be in the future');
      }
    }
    return true;
  })
];

// Booking update validation
exports.validateUpdateBooking = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid booking ID'),
  
  body('mentorName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Mentor name must be between 2 and 100 characters'),
  
  body('mentorPosition')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Mentor position must be between 2 and 200 characters'),
  
  body('mentorImage')
    .optional()
    .isURL()
    .withMessage('Please provide a valid mentor image URL'),
  
  body('sessionType')
    .optional()
    .isIn(Object.values(SessionTypes))
    .withMessage(`Session type must be one of: ${Object.values(SessionTypes).join(', ')}`),
  
  body('duration')
    .optional()
    .isIn(Object.values(Durations))
    .withMessage(`Duration must be one of: ${Object.values(Durations).join(', ')}`),
  
  body('topic')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Topic must be between 5 and 500 characters'),
  
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number'),
  
  body('meetingLink')
    .optional()
    .isURL()
    .withMessage('Please provide a valid meeting link'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters')
];

// Booking ID validation
exports.validateBookingId = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid booking ID')
];

// User ID validation
exports.validateUserId = [
  param('userId')
    .isMongoId()
    .withMessage('Please provide a valid user ID')
];

// Mentor ID validation
exports.validateMentorId = [
  param('mentorId')
    .isMongoId()
    .withMessage('Please provide a valid mentor ID')
];

// Rating validation
exports.validateRating = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid booking ID'),
  
  body('rating')
    .isFloat({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Feedback cannot exceed 1000 characters')
];

// Reschedule validation
exports.validateReschedule = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid booking ID'),
  
  body('newDate')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('New date must be in YYYY-MM-DD format')
    .custom((date) => {
      const bookingDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (bookingDate < today) {
        throw new Error('New booking date cannot be in the past');
      }
      return true;
    }),
  
  body('newTime')
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('New time must be in HH:MM format'),
  
  // Custom validation for new date and time combination
  body('newTime').custom((time, { req }) => {
    const date = req.body.newDate;
    if (date && time) {
      const bookingDateTime = new Date(`${date}T${time}:00`);
      const now = new Date();
      
      if (bookingDateTime <= now) {
        throw new Error('New booking date and time must be in the future');
      }
    }
    return true;
  })
];

// Cancel booking validation
exports.validateCancelBooking = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid booking ID'),
  
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason cannot exceed 500 characters')
];

// Query validation for filtering
exports.validateBookingQuery = [
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
    .isIn(Object.values(BookingStatuses))
    .withMessage(`Status must be one of: ${Object.values(BookingStatuses).join(', ')}`),
  
  query('sessionType')
    .optional()
    .isIn(Object.values(SessionTypes))
    .withMessage(`Session type must be one of: ${Object.values(SessionTypes).join(', ')}`),
  
  query('mentorId')
    .optional()
    .isMongoId()
    .withMessage('Mentor ID must be a valid MongoDB ObjectId'),
  
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('User ID must be a valid MongoDB ObjectId'),
  
  query('date')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format'),
  
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'date', 'time', 'status'])
    .withMessage('sortBy must be one of: createdAt, updatedAt, date, time, status'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be either asc or desc')
];

// Available slots validation
exports.validateAvailableSlots = [
  param('mentorId')
    .isMongoId()
    .withMessage('Please provide a valid mentor ID'),
  
  param('date')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format')
    .custom((date) => {
      const checkDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (checkDate < today) {
        throw new Error('Date cannot be in the past');
      }
      return true;
    })
];