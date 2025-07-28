const express = require('express');
const router = express.Router();
const BookingController = require('../controllers/bookingController');
const {
  validateCreateBooking,
  validateUpdateBooking,
  validateBookingId,
  validateUserId,
  validateMentorId,
  validateRating,
  validateReschedule,
  validateCancelBooking,
  validateBookingQuery,
  validateAvailableSlots,
  handleValidationErrors
} = require('../middleware/bookingValidation');

// GET /api/v1/bookings - Get all bookings with filtering and pagination
router.get('/', 
  validateBookingQuery,
  handleValidationErrors,
  BookingController.getAllBookings
);

// GET /api/v1/bookings/enums - Get booking enums (statuses, session types, durations)
router.get('/enums', BookingController.getBookingEnums);

// GET /api/v1/bookings/statistics - Get booking statistics
router.get('/statistics', BookingController.getBookingStatistics);

// GET /api/v1/bookings/:id - Get booking by ID
router.get('/:id', 
  validateBookingId,
  handleValidationErrors,
  BookingController.getBookingById
);

// POST /api/v1/bookings - Create new booking
router.post('/', 
  validateCreateBooking,
  handleValidationErrors,
  BookingController.createBooking
);

// PUT /api/v1/bookings/:id - Update booking
router.put('/:id', 
  validateUpdateBooking,
  handleValidationErrors,
  BookingController.updateBooking
);

// DELETE /api/v1/bookings/:id - Delete booking (soft delete)
router.delete('/:id', 
  validateBookingId,
  handleValidationErrors,
  BookingController.deleteBooking
);

// GET /api/v1/bookings/mentor/:mentorId - Get bookings by mentor ID
router.get('/mentor/:mentorId', 
  validateMentorId,
  handleValidationErrors,
  BookingController.getBookingsByMentorId
);

// GET /api/v1/bookings/user/:userId - Get bookings by user ID
router.get('/user/:userId', 
  validateUserId,
  handleValidationErrors,
  BookingController.getBookingsByUserId
);

// GET /api/v1/bookings/mentor/:mentorId/available/:date - Get available time slots
router.get('/mentor/:mentorId/available/:date', 
  validateAvailableSlots,
  handleValidationErrors,
  BookingController.getAvailableTimeSlots
);

// PUT /api/v1/bookings/:id/confirm - Confirm booking
router.put('/:id/confirm', 
  validateBookingId,
  handleValidationErrors,
  BookingController.confirmBooking
);

// PUT /api/v1/bookings/:id/complete - Complete booking
router.put('/:id/complete', 
  validateBookingId,
  handleValidationErrors,
  BookingController.completeBooking
);

// PUT /api/v1/bookings/:id/cancel - Cancel booking
router.put('/:id/cancel', 
  validateCancelBooking,
  handleValidationErrors,
  BookingController.cancelBooking
);

// PUT /api/v1/bookings/:id/reschedule - Reschedule booking
router.put('/:id/reschedule', 
  validateReschedule,
  handleValidationErrors,
  BookingController.rescheduleBooking
);

// PUT /api/v1/bookings/:id/rating - Add rating and feedback
router.put('/:id/rating', 
  validateRating,
  handleValidationErrors,
  BookingController.addRating
);

module.exports = router;