const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

// Validation middleware
const validatePhoneNumber = [
  body('phone')
    .isMobilePhone('en-IN')
    .withMessage('Please provide a valid Indian phone number'),
  handleValidationErrors
];

const validateOTP = [
  body('phone')
    .isMobilePhone('en-IN')
    .withMessage('Please provide a valid Indian phone number'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number'),
  handleValidationErrors
];

const validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  handleValidationErrors
];

// Public routes
router.post('/send-otp', validatePhoneNumber, authController.sendOTP);
router.post('/verify-otp', validateOTP, authController.verifyOTP);
router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.post('/logout', protect, authController.logout);
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, validateProfileUpdate, authController.updateProfile);

// Add validation for registration completion
const validateRegistrationCompletion = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  handleValidationErrors
];

// Add the new route
router.post('/complete-registration', validateRegistrationCompletion, authController.completeRegistration);
module.exports = router;