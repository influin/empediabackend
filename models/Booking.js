const mongoose = require('mongoose');

// Booking Status Enum
const bookingStatuses = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RESCHEDULED: 'rescheduled'
};

// Session Types Enum
const sessionTypes = {
  VIDEO_CALL: '1:1 Video Call',
  MOCK_INTERVIEW: 'Mock Interview',
  DOCUMENT_REVIEW: 'Document Review',
  TEXT_CONSULTATION: 'Text Consultation'
};

// Duration Enum
const durations = {
  THIRTY_MIN: '30min',
  SIXTY_MIN: '60min',
  NINETY_MIN: '90min',
  ONE_TWENTY_MIN: '120min'
};

// Booking Schema
// Update mentorId reference to point to User instead of Mentor
const bookingSchema = new mongoose.Schema({
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Changed from 'Mentor' to 'User'
    required: [true, 'Mentor ID is required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Session ID is required']
  },
  sessionType: {
    type: String,
    required: [true, 'Session type is required'],
    enum: ['1:1 Video Call', 'Mock Interview', 'Document Review', 'Text Consultation']
  },
  duration: {
    type: String,
    required: [true, 'Duration is required'],
    enum: ['30min', '60min', '90min', '120min']
  },
  date: {
    type: String,
    required: [true, 'Date is required'],
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format']
  },
  time: {
    type: String,
    required: [true, 'Time is required'],
    match: [/^\d{2}:\d{2}$/, 'Time must be in HH:MM format']
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: Object.values(bookingStatuses),
    default: bookingStatuses.PENDING
  },
  topic: {
    type: String,
    required: [true, 'Topic is required'],
    trim: true,
    maxlength: [500, 'Topic cannot exceed 500 characters']
  },
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    default: null
  },
  feedback: {
    type: String,
    trim: true,
    maxlength: [1000, 'Feedback cannot exceed 1000 characters'],
    default: null
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  meetingLink: {
    type: String,
    match: [/^https?:\/\/.+/, 'Please provide a valid meeting link'],
    default: null
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full datetime
bookingSchema.virtual('fullDateTime').get(function() {
  return `${this.date} ${this.time}`;
});

// Virtual for duration in minutes
bookingSchema.virtual('durationInMinutes').get(function() {
  return parseInt(this.duration.replace('min', ''));
});

// Virtual for session end time
bookingSchema.virtual('endTime').get(function() {
  const [hours, minutes] = this.time.split(':').map(Number);
  const durationMinutes = this.durationInMinutes;
  const endMinutes = minutes + durationMinutes;
  const endHours = hours + Math.floor(endMinutes / 60);
  const finalMinutes = endMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
});

// Indexes for better query performance
bookingSchema.index({ mentorId: 1, date: 1, time: 1 });
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ status: 1, date: 1 });
bookingSchema.index({ createdAt: -1 });

// Static methods
bookingSchema.statics.getStatuses = function() {
  return bookingStatuses;
};

// Instance methods
bookingSchema.methods.confirm = function() {
  this.status = bookingStatuses.CONFIRMED;
  return this.save();
};

bookingSchema.methods.complete = function() {
  this.status = bookingStatuses.COMPLETED;
  this.completedAt = new Date();
  return this.save();
};

bookingSchema.methods.cancel = function(reason) {
  this.status = bookingStatuses.CANCELLED;
  this.cancelledAt = new Date();
  if (reason) {
    this.cancellationReason = reason;
  }
  return this.save();
};

bookingSchema.methods.reschedule = function(newDate, newTime) {
  this.status = bookingStatuses.RESCHEDULED;
  this.date = newDate;
  this.time = newTime;
  return this.save();
};

bookingSchema.methods.addRating = function(rating, feedback) {
  this.rating = rating;
  if (feedback) {
    this.feedback = feedback;
  }
  return this.save();
};

// Pre-save middleware
bookingSchema.pre('save', function(next) {
  // Validate that the booking date is not in the past
  const bookingDateTime = new Date(`${this.date}T${this.time}:00`);
  const now = new Date();
  
  if (this.isNew && bookingDateTime < now) {
    return next(new Error('Booking date and time cannot be in the past'));
  }
  
  next();
});

// Update population in pre-find middleware
bookingSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'mentorId',
    match: { roles: 'mentor' }, // Only populate if user is a mentor
    select: 'name email profileImage mentorProfile'
  }).populate({
    path: 'userId',
    select: 'name email profileImage'
  });
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.BookingStatuses = bookingStatuses;
module.exports.SessionTypes = sessionTypes;
module.exports.Durations = durations;