const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const smsService = require('../services/smsService');

class AuthController {
  // Send OTP for login/registration
  static async sendOTP(req, res) {
    try {
      const { phone } = req.body;
      
      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }
      
      // Normalize phone number
      const normalizedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
      
      // Check if user exists
      let user = await User.findByPhone(normalizedPhone).select('+otp +otpExpires +lastOtpSent +otpAttempts');
      
      // Rate limiting - prevent spam
      if (user && user.lastOtpSent) {
        const timeSinceLastOTP = Date.now() - user.lastOtpSent;
        if (timeSinceLastOTP < 60000) { // 1 minute
          return res.status(429).json({
            success: false,
            message: 'Please wait before requesting another OTP',
            retryAfter: Math.ceil((60000 - timeSinceLastOTP) / 1000)
          });
        }
      }
      
      // Create user if doesn't exist
      if (!user) {
        user = new User({
          phone: normalizedPhone,
          name: '', // Will be updated after OTP verification
          email: `temp_${Date.now()}@temp.com`, // Temporary email
          password: crypto.randomBytes(32).toString('hex') // Random password
        });
      }
      
      // Generate and send OTP
      const otp = user.generateOTP();
      await user.save();
      
      // Send OTP via Fast2SMS
      const smsResult = await smsService.sendOTP(normalizedPhone, otp);
      
      if (!smsResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to send OTP',
          error: smsResult.message
        });
      }
      
      res.json({
        success: true,
        message: 'OTP sent successfully',
        isNewUser: !user.name || user.name === '',
        expiresIn: 600, // 10 minutes
        smsData: smsResult.data
      });
      
    } catch (error) {
      console.error('Send OTP Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error sending OTP',
        error: error.message
      });
    }
  }
  
  // Verify OTP and login/register
  static async verifyOTP(req, res) {
    try {
      const { phone, otp } = req.body; // Remove name and email from here
      
      if (!phone || !otp) {
        return res.status(400).json({
          success: false,
          message: 'Phone number and OTP are required'
        });
      }
      
      // Normalize phone number
      const normalizedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
      
      // Find user
      const user = await User.findByPhone(normalizedPhone).select('+otp +otpExpires +otpAttempts');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found. Please request OTP first.'
        });
      }
      
      // Check OTP attempts
      if (user.otpAttempts >= 5) {
        return res.status(429).json({
          success: false,
          message: 'Too many failed attempts. Please request a new OTP.'
        });
      }
      
      // Verify OTP
      if (!user.verifyOTP(otp)) {
        user.otpAttempts += 1;
        await user.save();
        
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP',
          attemptsLeft: 5 - user.otpAttempts
        });
      }
      
      // Check if new user (incomplete profile)
      const isNewUser = !user.name || user.name === '';
      
      // Mark phone as verified and clear OTP
      user.phoneVerified = true;
      user.clearOTP();
      user.lastLogin = Date.now();
      user.isActive = true;
      
      await user.save();
      
      // For new users, don't generate tokens yet - they need to complete registration
      if (isNewUser) {
        return res.json({
          success: true,
          message: 'OTP verified successfully. Please complete your registration.',
          isNewUser: true,
          userId: user._id, // Send user ID for registration completion
          requiresRegistration: true
        });
      }
      
      // For existing users, generate tokens and login
      const authToken = user.generateAuthToken();
      const refreshToken = user.generateRefreshToken();
      
      // Save refresh token
      user.refreshTokens.push({ token: refreshToken });
      await user.save();
      
      // Remove sensitive data
      user.password = undefined;
      user.refreshTokens = undefined;
      
      res.json({
        success: true,
        message: 'Login successful',
        isNewUser: false,
        user,
        tokens: {
          accessToken: authToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRE || '1h'
        }
      });
      
    } catch (error) {
      console.error('Verify OTP Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying OTP',
        error: error.message
      });
    }
  }
  
  // Refresh access token
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }
      
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      // Find user and check if refresh token exists
      const user = await User.findById(decoded.id);
      if (!user || !user.refreshTokens.some(token => token.token === refreshToken)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }
      
      // Generate new tokens
      const newAccessToken = user.generateAuthToken();
      const newRefreshToken = user.generateRefreshToken();
      
      // Replace old refresh token with new one
      user.refreshTokens = user.refreshTokens.filter(token => token.token !== refreshToken);
      user.refreshTokens.push({ token: newRefreshToken });
      await user.save();
      
      res.json({
        success: true,
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: process.env.JWT_EXPIRE || '1h'
        }
      });
      
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        error: error.message
      });
    }
  }
  
  // Logout
  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const user = req.user;
      
      if (refreshToken) {
        // Remove specific refresh token
        user.refreshTokens = user.refreshTokens.filter(token => token.token !== refreshToken);
      } else {
        // Remove all refresh tokens (logout from all devices)
        user.refreshTokens = [];
      }
      
      await user.save();
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error during logout',
        error: error.message
      });
    }
  }
  
  // Get current user profile
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id)
        .populate('education')
        .populate('experience')
        .populate('achievements')
        .populate('certifications');
      
      res.json({
        success: true,
        data: user
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching profile',
        error: error.message
      });
    }
  }
  
  // Update user profile
  static async updateProfile(req, res) {
    try {
      const allowedUpdates = ['name', 'email', 'skills', 'preferences'];
      const updates = {};
      
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });
      
      // Check email uniqueness if updating email
      if (updates.email) {
        const existingUser = await User.findByEmail(updates.email);
        if (existingUser && existingUser._id.toString() !== req.user.id) {
          return res.status(400).json({
            success: false,
            message: 'Email already exists'
          });
        }
      }
      
      const user = await User.findByIdAndUpdate(
        req.user.id,
        updates,
        { new: true, runValidators: true }
      );
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating profile',
        error: error.message
      });
    }
  }
  
  // Change password (for users who want to set a password)
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password is required'
        });
      }
      
      const user = await User.findById(req.user.id).select('+password');
      
      // If user has a password, verify current password
      if (user.password && currentPassword) {
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({
            success: false,
            message: 'Current password is incorrect'
          });
        }
      }
      
      user.password = newPassword;
      await user.save();
      
      res.json({
        success: true,
        message: 'Password updated successfully'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating password',
        error: error.message
      });
    }
  }
  
  // Complete user registration after OTP verification
  static async completeRegistration(req, res) {
    try {
      const { userId, name, email } = req.body;
      
      if (!userId || !name) {
        return res.status(400).json({
          success: false,
          message: 'User ID and name are required'
        });
      }
      
      // Find user
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check if user already completed registration
      if (user.name && user.name !== '') {
        return res.status(400).json({
          success: false,
          message: 'User registration already completed'
        });
      }
      
      // Check if phone is verified
      if (!user.phoneVerified) {
        return res.status(400).json({
          success: false,
          message: 'Phone number not verified'
        });
      }
      
      // Update user profile
      user.name = name;
      if (email) {
        // Check if email already exists
        const existingEmailUser = await User.findByEmail(email);
        if (existingEmailUser && existingEmailUser._id.toString() !== user._id.toString()) {
          return res.status(400).json({
            success: false,
            message: 'Email already exists'
          });
        }
        user.email = email;
      }
      
      await user.save();
      
      // Generate tokens
      const authToken = user.generateAuthToken();
      const refreshToken = user.generateRefreshToken();
      
      // Save refresh token
      user.refreshTokens.push({ token: refreshToken });
      await user.save();
      
      // Remove sensitive data
      user.password = undefined;
      user.refreshTokens = undefined;
      
      res.json({
        success: true,
        message: 'Registration completed successfully',
        user,
        tokens: {
          accessToken: authToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRE || '1h'
        }
      });
      
    } catch (error) {
      console.error('Complete Registration Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error completing registration',
        error: error.message
      });
    }
  }
}

module.exports = AuthController;