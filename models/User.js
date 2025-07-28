const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Preferences Schema
const userPreferencesSchema = new mongoose.Schema({
  notificationsEnabled: {
    type: Boolean,
    default: true
  },
  emailNotifications: {
    type: Boolean,
    default: true
  },
  pushNotifications: {
    type: Boolean,
    default: true
  },
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko']
  },
  theme: {
    type: String,
    default: 'light',
    enum: ['light', 'dark', 'auto']
  }
}, { _id: false });

// Main User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    // required: [true, 'Name is required'], // Remove this line
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  // Add these fields to the User schema (around line 45 after phone field)
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String,
    select: false
  },
  otpExpires: {
    type: Date,
    select: false
  },
  otpAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  lastOtpSent: {
    type: Date,
    select: false
  },
  profileImage: {
    type: String,
    default: null
  },
  coverImage: {
    type: String,
    default: null
  },
  profileCompletion: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Role Management
  roles: {
    type: [String],
    enum: ['user', 'mentor', 'jobPoster', 'admin'],
    default: ['user']
  },
  
  // Basic Profile Information
  skills: [{
    type: String,
    trim: true
  }],
  education: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Education'
  }],
  experience: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Experience'
  }],
  achievements: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement'
  }],
  certifications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certification'
  }],
  badges: [{
    type: String,
    trim: true
  }],
  
  // Mentor-specific fields (only populated if user is a mentor)
  mentorProfile: {
    position: {
      type: String,
      trim: true,
      maxlength: [200, 'Position cannot exceed 200 characters']
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [2000, 'Bio cannot exceed 2000 characters']
    },
    expertise: {
      type: [String],
      default: []
    },
    experienceYears: {
      type: Number,
      min: [0, 'Experience years cannot be negative'],
      max: [50, 'Experience years cannot exceed 50']
    },
    company: {
      type: String,
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters']
    },
    linkedinUrl: {
      type: String,
      match: [/^https?:\/\/(www\.)?linkedin\.com\/.+/, 'Please provide a valid LinkedIn URL']
    },
    availableSessions: [{
      type: {
        type: String,
        enum: ['1:1 Video Call', 'Mock Interview', 'Document Review', 'Text Consultation']
      },
      duration: {
        type: String,
        enum: ['30min', '60min', '90min', '120min']
      },
      price: {
        type: Number,
        min: [0, 'Price cannot be negative']
      },
      description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
      }
    }],
    reviews: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      userName: String,
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: {
        type: String,
        maxlength: [1000, 'Comment cannot exceed 1000 characters']
      },
      userImage: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    isAvailable: {
      type: Boolean,
      default: true
    },
    hourlyRate: {
      type: Number,
      min: [0, 'Hourly rate cannot be negative']
    },
    languages: {
      type: [String],
      default: ['English']
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    totalBookings: {
      type: Number,
      default: 0
    },
    completedSessions: {
      type: Number,
      default: 0
    },
    responseTime: {
      type: String,
      default: '24 hours'
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    }
  },
  
  preferences: {
    type: userPreferencesSchema,
    default: () => ({})
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 604800
    }
  }],
  lastLogin: Date,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ 'refreshTokens.token': 1 });
userSchema.index({ 'mentorProfile.expertise': 1 });
userSchema.index({ 'mentorProfile.isAvailable': 1 });

// Virtual for user ID
userSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Virtual for mentor average rating
userSchema.virtual('mentorProfile.averageRating').get(function() {
  if (!this.mentorProfile?.reviews || this.mentorProfile.reviews.length === 0) return 0;
  const sum = this.mentorProfile.reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / this.mentorProfile.reviews.length) * 10) / 10;
});

// Virtual for mentor total reviews
userSchema.virtual('mentorProfile.totalReviews').get(function() {
  return this.mentorProfile?.reviews?.length || 0;
});

// Virtual for mentor completion rate
userSchema.virtual('mentorProfile.completionRate').get(function() {
  if (!this.mentorProfile?.totalBookings || this.mentorProfile.totalBookings === 0) return 0;
  return Math.round((this.mentorProfile.completedSessions / this.mentorProfile.totalBookings) * 100);
});

// Role management methods
userSchema.methods.hasRole = function(role) {
  return this.roles.includes(role);
};

userSchema.methods.addRole = function(role) {
  if (!this.hasRole(role)) {
    this.roles.push(role);
  }
  return this.save();
};

userSchema.methods.removeRole = function(role) {
  this.roles = this.roles.filter(r => r !== role);
  return this.save();
};

// Mentor-specific methods
userSchema.methods.becomeMentor = function(mentorData) {
  if (!this.hasRole('mentor')) {
    this.roles.push('mentor');
  }
  this.mentorProfile = {
    ...this.mentorProfile,
    ...mentorData
  };
  return this.save();
};

userSchema.methods.addMentorReview = function(reviewData) {
  if (!this.mentorProfile) {
    throw new Error('User is not a mentor');
  }
  
  // Check if user already reviewed
  const existingReview = this.mentorProfile.reviews.find(
    review => review.userId.toString() === reviewData.userId.toString()
  );
  
  if (existingReview) {
    throw new Error('User has already reviewed this mentor');
  }
  
  this.mentorProfile.reviews.push(reviewData);
  return this.save();
};

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to calculate profile completion
userSchema.methods.calculateProfileCompletion = function() {
  let completion = 0;
  const fields = {
    name: 10,
    email: 10,
    phone: 5,
    profileImage: 10,
    skills: 15,
    education: 20,
    experience: 20,
    achievements: 5,
    certifications: 5
  };
  
  Object.keys(fields).forEach(field => {
    if (this[field]) {
      if (Array.isArray(this[field]) && this[field].length > 0) {
        completion += fields[field];
      } else if (!Array.isArray(this[field])) {
        completion += fields[field];
      }
    }
  });
  
  this.profileCompletion = completion;
  return completion;
};

// Method to generate auth token
userSchema.methods.generateAuthToken = function() {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { 
      id: this._id,
      email: this.email,
      name: this.name,
      roles: this.roles
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '1h' }
  );
};

// Method to generate refresh token
userSchema.methods.generateRefreshToken = function() {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find mentors
userSchema.statics.findMentors = function(filters = {}) {
  const query = { roles: 'mentor', isActive: true };
  
  if (filters.expertise) {
    query['mentorProfile.expertise'] = { $in: filters.expertise };
  }
  
  if (filters.isAvailable !== undefined) {
    query['mentorProfile.isAvailable'] = filters.isAvailable;
  }
  
  if (filters.minRating) {
    // This would need to be handled in aggregation for calculated averageRating
  }
  
  return this.find(query);
};

// Add these methods before module.exports
// Method to generate OTP
userSchema.methods.generateOTP = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = otp;
  this.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  this.lastOtpSent = Date.now();
  return otp;
};

// Method to verify OTP
userSchema.methods.verifyOTP = function(candidateOTP) {
  if (!this.otp || !this.otpExpires) {
    return false;
  }
  
  if (Date.now() > this.otpExpires) {
    return false;
  }
  
  return this.otp === candidateOTP;
};

// Method to clear OTP
userSchema.methods.clearOTP = function() {
  this.otp = undefined;
  this.otpExpires = undefined;
  this.otpAttempts = 0;
};

// Static method to find by phone
userSchema.statics.findByPhone = function(phone) {
  return this.findOne({ phone: phone });
};

module.exports = mongoose.model('User', userSchema);