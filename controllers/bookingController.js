const Booking = require('../models/Booking');
const User = require('../models/User');
const mongoose = require('mongoose');

class BookingController {
  // Get all bookings
  static async getAllBookings(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        mentorId,
        userId,
        sessionType,
        date,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const query = { isActive: true };
      
      // Add filters
      if (status) query.status = status;
      if (mentorId) query.mentorId = mentorId;
      if (userId) query.userId = userId;
      if (sessionType) query.sessionType = sessionType;
      if (date) query.date = date;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
        populate: [
          { path: 'mentorId', select: 'name email phone' },
          { path: 'userId', select: 'name email phone' }
        ]
      };

      const bookings = await Booking.find(query)
        .populate(options.populate)
        .sort(options.sort)
        .limit(options.limit * 1)
        .skip((options.page - 1) * options.limit);

      const total = await Booking.countDocuments(query);

      res.json({
        success: true,
        count: bookings.length,
        total,
        page: options.page,
        pages: Math.ceil(total / options.limit),
        data: bookings
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching bookings',
        error: error.message
      });
    }
  }

  // Get booking by ID
  static async getBookingById(req, res) {
    try {
      const booking = await Booking.findById(req.params.id)
        .populate('mentorId', 'name email phone')
        .populate('userId', 'name email phone');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      res.json({
        success: true,
        data: booking
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error fetching booking',
        error: error.message
      });
    }
  }

  // Create new booking
  // Update the populate options in all methods:
   populateOptions = [
    { 
      path: 'mentorId', 
      select: 'name position imageUrl rating company experienceYears isAvailable',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    },
    { path: 'userId', select: 'name email phone' }
  ];
  
  // In createBooking method, add validation:
  static async createBooking(req, res) {
    try {
      // Verify mentor and user exist
      const [mentor, user] = await Promise.all([
        Mentor.findById(req.body.mentorId),
        User.findById(req.body.userId)
      ]);
  
      if (!mentor) {
        return res.status(404).json({
          success: false,
          message: 'Mentor not found'
        });
      }
  
      if (!mentor.isAvailable) {
        return res.status(400).json({
          success: false,
          message: 'Mentor is not available for bookings'
        });
      }
  
      // Verify session exists in mentor's available sessions
      const session = mentor.availableSessions.id(req.body.sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found in mentor\'s available sessions'
        });
      }
  
      // Set session details from mentor's session
      req.body.sessionType = session.type;
      req.body.duration = session.duration;
      req.body.price = session.price;
  
      const booking = new Booking(req.body);
      await booking.save();
      
      await booking.populate([
        { path: 'mentorId', select: 'name email phone' },
        { path: 'userId', select: 'name email phone' }
      ]);
  
      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        data: booking
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }));
        
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating booking',
        error: error.message
      });
    }
  }

  // Update booking
  static async updateBooking(req, res) {
    try {
      const booking = await Booking.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      ).populate([
        { path: 'mentorId', select: 'name email phone' },
        { path: 'userId', select: 'name email phone' }
      ]);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      res.json({
        success: true,
        message: 'Booking updated successfully',
        data: booking
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }));
        
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors
        });
      }
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating booking',
        error: error.message
      });
    }
  }

  // Delete booking (soft delete)
  static async deleteBooking(req, res) {
    try {
      const booking = await Booking.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      res.json({
        success: true,
        message: 'Booking deleted successfully'
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error deleting booking',
        error: error.message
      });
    }
  }

  // Get bookings by mentor ID
  static async getBookingsByMentorId(req, res) {
    try {
      const { status, date, page = 1, limit = 10 } = req.query;
      const query = { mentorId: req.params.mentorId, isActive: true };
      
      if (status) query.status = status;
      if (date) query.date = date;

      const bookings = await Booking.find(query)
        .populate('userId', 'name email phone')
        .sort({ date: 1, time: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Booking.countDocuments(query);

      res.json({
        success: true,
        count: bookings.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        data: bookings
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching mentor bookings',
        error: error.message
      });
    }
  }

  // Get bookings by user ID
  static async getBookingsByUserId(req, res) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const query = { userId: req.params.userId, isActive: true };
      
      if (status) query.status = status;

      const bookings = await Booking.find(query)
        .populate('mentorId', 'name email phone')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Booking.countDocuments(query);

      res.json({
        success: true,
        count: bookings.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        data: bookings
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user bookings',
        error: error.message
      });
    }
  }

  // Confirm booking
  static async confirmBooking(req, res) {
    try {
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (booking.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending bookings can be confirmed'
        });
      }

      await booking.confirm();
      await booking.populate([
        { path: 'mentorId', select: 'name email phone' },
        { path: 'userId', select: 'name email phone' }
      ]);

      res.json({
        success: true,
        message: 'Booking confirmed successfully',
        data: booking
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error confirming booking',
        error: error.message
      });
    }
  }

  // Complete booking
  static async completeBooking(req, res) {
    try {
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (booking.status !== 'confirmed') {
        return res.status(400).json({
          success: false,
          message: 'Only confirmed bookings can be completed'
        });
      }

      await booking.complete();
      await booking.populate([
        { path: 'mentorId', select: 'name email phone' },
        { path: 'userId', select: 'name email phone' }
      ]);

      res.json({
        success: true,
        message: 'Booking completed successfully',
        data: booking
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error completing booking',
        error: error.message
      });
    }
  }

  // Cancel booking
  static async cancelBooking(req, res) {
    try {
      const { reason } = req.body;
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (['completed', 'cancelled'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel completed or already cancelled bookings'
        });
      }

      await booking.cancel(reason);
      await booking.populate([
        { path: 'mentorId', select: 'name email phone' },
        { path: 'userId', select: 'name email phone' }
      ]);

      res.json({
        success: true,
        message: 'Booking cancelled successfully',
        data: booking
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error cancelling booking',
        error: error.message
      });
    }
  }

  // Reschedule booking
  static async rescheduleBooking(req, res) {
    try {
      const { newDate, newTime } = req.body;
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (['completed', 'cancelled'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot reschedule completed or cancelled bookings'
        });
      }

      // Check for conflicts with new time slot
      const conflictingBooking = await Booking.findOne({
        mentorId: booking.mentorId,
        date: newDate,
        time: newTime,
        status: { $in: ['pending', 'confirmed'] },
        isActive: true,
        _id: { $ne: booking._id }
      });

      if (conflictingBooking) {
        return res.status(409).json({
          success: false,
          message: 'Mentor is not available at the new time slot'
        });
      }

      await booking.reschedule(newDate, newTime);
      await booking.populate([
        { path: 'mentorId', select: 'name email phone' },
        { path: 'userId', select: 'name email phone' }
      ]);

      res.json({
        success: true,
        message: 'Booking rescheduled successfully',
        data: booking
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error rescheduling booking',
        error: error.message
      });
    }
  }

  // Add rating and feedback
  static async addRating(req, res) {
    try {
      const { rating, feedback } = req.body;
      const booking = await Booking.findById(req.params.id);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (booking.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Can only rate completed bookings'
        });
      }

      await booking.addRating(rating, feedback);
      await booking.populate([
        { path: 'mentorId', select: 'name email phone' },
        { path: 'userId', select: 'name email phone' }
      ]);

      res.json({
        success: true,
        message: 'Rating added successfully',
        data: booking
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error adding rating',
        error: error.message
      });
    }
  }

  // Get booking statistics
  static async getBookingStatistics(req, res) {
    try {
      const { mentorId, userId, startDate, endDate } = req.query;
      const matchQuery = { isActive: true };
      
      if (mentorId) matchQuery.mentorId = mongoose.Types.ObjectId(mentorId);
      if (userId) matchQuery.userId = mongoose.Types.ObjectId(userId);
      if (startDate && endDate) {
        matchQuery.date = { $gte: startDate, $lte: endDate };
      }

      const stats = await Booking.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            pendingBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            confirmedBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
            },
            completedBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            cancelledBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            averageRating: { $avg: '$rating' },
            totalRevenue: { $sum: '$price' }
          }
        }
      ]);

      const sessionTypeStats = await Booking.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$sessionType',
            count: { $sum: 1 },
            averageRating: { $avg: '$rating' }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          overview: stats[0] || {
            totalBookings: 0,
            pendingBookings: 0,
            confirmedBookings: 0,
            completedBookings: 0,
            cancelledBookings: 0,
            averageRating: 0,
            totalRevenue: 0
          },
          bySessionType: sessionTypeStats
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching booking statistics',
        error: error.message
      });
    }
  }

  // Get available time slots for a mentor on a specific date
  static async getAvailableTimeSlots(req, res) {
    try {
      const { mentorId, date } = req.params;
      
      // Get all booked time slots for the mentor on the specified date
      const bookedSlots = await Booking.find({
        mentorId,
        date,
        status: { $in: ['pending', 'confirmed'] },
        isActive: true
      }).select('time duration');

      // Define all possible time slots (you can customize this)
      const allTimeSlots = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
        '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
        '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'
      ];

      // Filter out booked slots
      const availableSlots = allTimeSlots.filter(slot => {
        return !bookedSlots.some(booking => {
          const bookingStart = booking.time;
          const durationMinutes = parseInt(booking.duration.replace('min', ''));
          const [hours, minutes] = bookingStart.split(':').map(Number);
          const endMinutes = minutes + durationMinutes;
          const endHours = hours + Math.floor(endMinutes / 60);
          const finalMinutes = endMinutes % 60;
          const bookingEnd = `${String(endHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
          
          return slot >= bookingStart && slot < bookingEnd;
        });
      });

      res.json({
        success: true,
        data: {
          date,
          availableSlots,
          bookedSlots: bookedSlots.map(b => ({ time: b.time, duration: b.duration }))
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching available time slots',
        error: error.message
      });
    }
  }

  // Get booking enums
  static async getBookingEnums(req, res) {
    try {
      res.json({
        success: true,
        data: {
          statuses: Booking.getStatuses(),
          sessionTypes: Booking.getSessionTypes(),
          durations: Booking.getDurations()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching booking enums',
        error: error.message
      });
    }
  }
}

module.exports = BookingController;