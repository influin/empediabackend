const User = require('../models/User');
const Job = require('../models/Job');
const MentorApplication = require('../models/MentorApplication');
const Booking = require('../models/Booking'); // Optional
const Admin = require('../models/Admin');
const Course = require('../models/Course');
const Company = require('../models/Company');
const JobApplication = require('../models/JobApplication');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AdminController {
  // Admin Authentication
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }
      
      // Find admin with password
      const admin = await Admin.findByEmail(email).select('+password');
      
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Check if account is locked
      if (admin.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Account is temporarily locked due to too many failed login attempts'
        });
      }
      
      // Check if admin is active
      if (!admin.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }
      
      // Verify password
      const isPasswordValid = await admin.comparePassword(password);
      
      if (!isPasswordValid) {
        await admin.incLoginAttempts();
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Reset login attempts on successful login
      if (admin.loginAttempts > 0) {
        await admin.resetLoginAttempts();
      }
      
      // Update last login
      admin.lastLogin = Date.now();
      await admin.save();
      
      // Generate tokens
      const authToken = admin.generateAuthToken();
      const refreshToken = admin.generateRefreshToken();
      
      // Save refresh token
      admin.refreshTokens.push({ token: refreshToken });
      await admin.save();
      
      // Remove sensitive data
      admin.password = undefined;
      admin.refreshTokens = undefined;
      
      res.json({
        success: true,
        message: 'Login successful',
        admin,
        tokens: {
          accessToken: authToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRE || '1h'
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error during login',
        error: error.message
      });
    }
  }
  
  // Admin logout
  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const admin = req.admin;
      
      if (refreshToken) {
        admin.refreshTokens = admin.refreshTokens.filter(token => token.token !== refreshToken);
      } else {
        admin.refreshTokens = [];
      }
      
      await admin.save();
      
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
  
  // Dashboard Statistics
  static async getDashboardStats(req, res) {
    try {
      const [userStats, jobStats, mentorStats, courseStats] = await Promise.all([
        // User Statistics
        User.aggregate([
          {
            $group: {
              _id: null,
              totalUsers: { $sum: 1 },
              activeUsers: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
              verifiedUsers: { $sum: { $cond: [{ $eq: ['$phoneVerified', true] }, 1, 0] } },
              mentors: { $sum: { $cond: [{ $in: ['mentor', '$roles'] }, 1, 0] } },
              jobPosters: { $sum: { $cond: [{ $in: ['jobPoster', '$roles'] }, 1, 0] } }
            }
          }
        ]),
        
        // Job Statistics
        Job.aggregate([
          {
            $group: {
              _id: null,
              totalJobs: { $sum: 1 },
              activeJobs: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
              pendingJobs: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
              closedJobs: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } }
            }
          }
        ]),
        
        // Mentor Application Statistics
        MentorApplication.aggregate([
          {
            $group: {
              _id: null,
              totalApplications: { $sum: 1 },
              pendingApplications: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
              approvedApplications: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
              rejectedApplications: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
            }
          }
        ]),
        
        // Course Statistics
        Course.aggregate([
          {
            $group: {
              _id: null,
              totalCourses: { $sum: 1 },
              publishedCourses: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
              draftCourses: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } }
            }
          }
        ])
      ]);
      
      // Recent activities
      const recentUsers = await User.find({}).sort({ createdAt: -1 }).limit(5).select('name email createdAt');
      const recentJobs = await Job.find({}).sort({ createdAt: -1 }).limit(5).select('position company status createdAt');
      const recentApplications = await MentorApplication.find({}).sort({ createdAt: -1 }).limit(5).populate('applicantId', 'name email');
      
      res.json({
        success: true,
        data: {
          statistics: {
            users: userStats[0] || {},
            jobs: jobStats[0] || {},
            mentorApplications: mentorStats[0] || {},
            courses: courseStats[0] || {}
          },
          recentActivities: {
            users: recentUsers,
            jobs: recentJobs,
            mentorApplications: recentApplications
          }
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching dashboard statistics',
        error: error.message
      });
    }
  }
  
  // User Management
  static async getAllUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const search = req.query.search || '';
      const role = req.query.role;
      const status = req.query.status;
      
      // Build filter
      const filter = {};
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }
      if (role) {
        filter.roles = role;
      }
      if (status) {
        filter.isActive = status === 'active';
      }
      
      const [users, total] = await Promise.all([
        User.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-password -refreshTokens'),
        User.countDocuments(filter)
      ]);
      
      res.json({
        success: true,
        data: {
          users,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error: error.message
      });
    }
  }
  
  // Get user by ID
  static async getUserById(req, res) {
    try {
      const user = await User.findById(req.params.id)
        .populate('education')
        .populate('experience')
        .populate('achievements')
        .populate('certifications')
        .select('-password -refreshTokens');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      res.json({
        success: true,
        data: user
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user',
        error: error.message
      });
    }
  }
  
  // Update user status
  static async updateUserStatus(req, res) {
    try {
      const { isActive } = req.body;
      
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive },
        { new: true }
      ).select('-password -refreshTokens');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      res.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: user
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating user status',
        error: error.message
      });
    }
  }
  
  // Delete user
  static async deleteUser(req, res) {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting user',
        error: error.message
      });
    }
  }
  
  // Mentor Application Management
  static async getAllMentorApplications(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const status = req.query.status;
      
      const filter = {};
      if (status) {
        filter.status = status;
      }
      
      const [applications, total] = await Promise.all([
        MentorApplication.find(filter)
          .populate('applicantId', 'name email phone')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        MentorApplication.countDocuments(filter)
      ]);
      
      res.json({
        success: true,
        data: {
          applications,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching mentor applications',
        error: error.message
      });
    }
  }
  
  // Approve mentor application
  static async approveMentorApplication(req, res) {
    try {
      const application = await MentorApplication.findById(req.params.id);
      
      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found'
        });
      }
      
      await application.approve(req.admin.id);
      
      res.json({
        success: true,
        message: 'Mentor application approved successfully'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error approving mentor application',
        error: error.message
      });
    }
  }
  
  // Reject mentor application
  static async rejectMentorApplication(req, res) {
    try {
      const { reason } = req.body;
      const application = await MentorApplication.findById(req.params.id);
      
      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found'
        });
      }
      
      await application.reject(req.admin.id, reason);
      
      res.json({
        success: true,
        message: 'Mentor application rejected successfully'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error rejecting mentor application',
        error: error.message
      });
    }
  }
  
  // Job Management
  static async getAllJobs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const status = req.query.status;
      
      const filter = {};
      if (status) {
        filter.status = status;
      }
      
      const [jobs, total] = await Promise.all([
        Job.find(filter)
          .populate('postedBy', 'name email')
          .populate('companyId', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Job.countDocuments(filter)
      ]);
      
      res.json({
        success: true,
        data: {
          jobs,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching jobs',
        error: error.message
      });
    }
  }
  
  // Approve job
  static async approveJob(req, res) {
    try {
      const job = await Job.findById(req.params.id);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }
      
      await job.approve();
      
      res.json({
        success: true,
        message: 'Job approved successfully'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error approving job',
        error: error.message
      });
    }
  }
  
  // Reject job
  static async rejectJob(req, res) {
    try {
      const { reason } = req.body;
      const job = await Job.findById(req.params.id);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }
      
      await job.reject(reason);
      
      res.json({
        success: true,
        message: 'Job rejected successfully'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error rejecting job',
        error: error.message
      });
    }
  }
  
  // System Settings
  static async getSystemSettings(req, res) {
    try {
      // This would typically come from a settings collection
      // For now, returning mock data
      const settings = {
        siteName: 'Empedia',
        maintenanceMode: false,
        registrationEnabled: true,
        emailNotifications: true,
        smsNotifications: true,
        maxFileSize: '10MB',
        allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
        sessionTimeout: '1h',
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false
        }
      };
      
      res.json({
        success: true,
        data: settings
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching system settings',
        error: error.message
      });
    }
  }
  
  // Update system settings
  static async updateSystemSettings(req, res) {
    try {
      // This would typically update a settings collection
      // For now, just returning success
      
      res.json({
        success: true,
        message: 'System settings updated successfully',
        data: req.body
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating system settings',
        error: error.message
      });
    }
  }
  
  // Admin Management (for superadmin)
  static async getAllAdmins(req, res) {
    try {
      const admins = await Admin.find({})
        .select('-password -refreshTokens')
        .sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: admins
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching admins',
        error: error.message
      });
    }
  }
  
  // Create new admin
  static async createAdmin(req, res) {
    try {
      const { name, email, password, role, permissions } = req.body;
      
      // Check if admin already exists
      const existingAdmin = await Admin.findByEmail(email);
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Admin with this email already exists'
        });
      }
      
      const admin = new Admin({
        name,
        email,
        password,
        role: role || 'admin',
        permissions: permissions || {}
      });
      
      await admin.save();
      
      // Remove password from response
      admin.password = undefined;
      
      res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        data: admin
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating admin',
        error: error.message
      });
    }
  }
  
  // Update admin
  static async updateAdmin(req, res) {
    try {
      const allowedUpdates = ['name', 'role', 'permissions', 'isActive'];
      const updates = {};
      
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });
      
      const admin = await Admin.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      ).select('-password -refreshTokens');
      
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Admin updated successfully',
        data: admin
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating admin',
        error: error.message
      });
    }
  }
  
  // Delete admin
  static async deleteAdmin(req, res) {
    try {
      const admin = await Admin.findByIdAndDelete(req.params.id);
      
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Admin deleted successfully'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting admin',
        error: error.message
      });
    }
  }

  // Admin forgot password
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      
      // Find admin by email
      const admin = await Admin.findByEmail(email);
      
      if (!admin) {
        // Don't reveal if email exists or not for security
        return res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent'
        });
      }
      
      // Generate reset token
      const resetToken = admin.generatePasswordResetToken();
      await admin.save();
      
      // Create reset URL
      const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/admin/reset-password/${resetToken}`;
      
      // Email content
      const message = `
        You are receiving this email because you (or someone else) has requested a password reset for your admin account.
        
        Please click on the following link to reset your password:
        ${resetUrl}
        
        If you did not request this, please ignore this email and your password will remain unchanged.
        
        This link will expire in 10 minutes.
      `;
      
      try {
        // Here you would send the email using your email service
        // For now, we'll just log it (replace with actual email service)
        console.log('Password reset email would be sent to:', email);
        console.log('Reset URL:', resetUrl);
        
        res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent'
        });
        
      } catch (emailError) {
        admin.passwordResetToken = undefined;
        admin.passwordResetExpires = undefined;
        await admin.save();
        
        return res.status(500).json({
          success: false,
          message: 'Email could not be sent'
        });
      }
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error processing forgot password request',
        error: error.message
      });
    }
  }
  
  // Admin reset password
  static async resetPassword(req, res) {
    try {
      const { token } = req.params;
      const { password, confirmPassword } = req.body;
      
      if (!password || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Password and confirm password are required'
        });
      }
      
      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }
      
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }
      
      // Hash the token to compare with stored token
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find admin with valid reset token
      const admin = await Admin.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });
      
      if (!admin) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }
      
      // Set new password
      admin.password = password;
      admin.passwordResetToken = undefined;
      admin.passwordResetExpires = undefined;
      admin.passwordChangedAt = Date.now();
      
      // Clear all refresh tokens for security
      admin.refreshTokens = [];
      
      await admin.save();
      
      res.json({
        success: true,
        message: 'Password reset successful. Please login with your new password.'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error resetting password',
        error: error.message
      });
    }
  }
  
  // Update user information
  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove sensitive fields that shouldn't be updated directly
      delete updateData.password;
      delete updateData.refreshToken;
      delete updateData.passwordResetToken;
      delete updateData.passwordResetExpires;

      const user = await User.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).select('-password -refreshToken');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: user
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user',
        error: error.message
      });
    }
  }

  // Activate user account
  static async activateUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findByIdAndUpdate(
        id,
        { 
          isActive: true,
          status: 'active',
          updatedAt: new Date()
        },
        { new: true }
      ).select('-password -refreshToken');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'User activated successfully',
        data: user
      });
    } catch (error) {
      console.error('Activate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to activate user',
        error: error.message
      });
    }
  }

  // Deactivate user account
  static async deactivateUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findByIdAndUpdate(
        id,
        { 
          isActive: false,
          status: 'inactive',
          refreshToken: null, // Clear refresh token on deactivation
          updatedAt: new Date()
        },
        { new: true }
      ).select('-password -refreshToken');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'User deactivated successfully',
        data: user
      });
    } catch (error) {
      console.error('Deactivate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate user',
        error: error.message
      });
    }
  }

  // Update user role
  static async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      // Validate role
      const validRoles = ['user', 'mentor', 'admin'];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Valid roles are: user, mentor, admin'
        });
      }

      const user = await User.findByIdAndUpdate(
        id,
        { 
          role: role,
          updatedAt: new Date()
        },
        { new: true }
      ).select('-password -refreshToken');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        message: `User role updated to ${role} successfully`,
        data: user
      });
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user role',
        error: error.message
      });
    }
  }
  
  // Get admin profile
  static async getProfile(req, res) {
    try {
      const admin = await Admin.findById(req.admin.id)
        .select('-password -refreshTokens -passwordResetToken -passwordResetExpires');
      
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }
      
      res.json({
        success: true,
        data: admin
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching admin profile',
        error: error.message
      });
    }
  }
  
  // Update admin profile
  static async updateProfile(req, res) {
    try {
      const allowedUpdates = ['name', 'email', 'phone', 'avatar'];
      const updates = {};
      
      // Filter allowed updates
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });
      
      // Check if email is being updated and if it already exists
      if (updates.email) {
        const existingAdmin = await Admin.findOne({
          email: updates.email,
          _id: { $ne: req.admin.id }
        });
        
        if (existingAdmin) {
          return res.status(400).json({
            success: false,
            message: 'Email already exists'
          });
        }
      }
      
      const admin = await Admin.findByIdAndUpdate(
        req.admin.id,
        updates,
        { new: true, runValidators: true }
      ).select('-password -refreshTokens -passwordResetToken -passwordResetExpires');
      
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: admin
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating profile',
        error: error.message
      });
    }
  }
  
  // Change admin password
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      
      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password, new password, and confirm password are required'
        });
      }
      
      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password and confirm password do not match'
        });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }
      
      // Get admin with password
      const admin = await Admin.findById(req.admin.id).select('+password');
      
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }
      
      // Verify current password
      const isCurrentPasswordValid = await admin.comparePassword(currentPassword);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
      
      // Update password
      admin.password = newPassword;
      admin.passwordChangedAt = Date.now();
      
      // Clear all refresh tokens for security
      admin.refreshTokens = [];
      
      await admin.save();
      
      res.json({
        success: true,
        message: 'Password changed successfully. Please login again with your new password.'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error changing password',
        error: error.message
      });
    }
  }
  
  // Refresh admin token
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
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }
      
      // Find admin and check if refresh token exists
      const admin = await Admin.findById(decoded.id);
      
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Admin not found'
        });
      }
      
      // Check if admin is active
      if (!admin.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }
      
      // Check if refresh token exists in admin's tokens
      const tokenExists = admin.refreshTokens.some(token => token.token === refreshToken);
      
      if (!tokenExists) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }
      
      // Generate new tokens
      const newAccessToken = admin.generateAuthToken();
      const newRefreshToken = admin.generateRefreshToken();
      
      // Remove old refresh token and add new one
      admin.refreshTokens = admin.refreshTokens.filter(token => token.token !== refreshToken);
      admin.refreshTokens.push({ token: newRefreshToken });
      
      await admin.save();
      
      res.json({
        success: true,
        message: 'Tokens refreshed successfully',
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: process.env.JWT_EXPIRE || '1h'
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error refreshing token',
        error: error.message
      });
    }
  }
  
  // Get admin by ID
  static async getAdminById(req, res) {
    try {
      const { id } = req.params;

      const admin = await Admin.findById(id).select('-password -refreshTokens');

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      res.status(200).json({
        success: true,
        data: admin
      });
    } catch (error) {
      console.error('Get admin by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get admin',
        error: error.message
      });
    }
  }

  // Get pending mentor applications
  static async getPendingMentorApplications(req, res) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const skip = (page - 1) * limit;

      const applications = await MentorApplication.find({ status: 'pending' })
        .populate('applicantId', 'name email phone')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await MentorApplication.countDocuments({ status: 'pending' });

      res.status(200).json({
        success: true,
        data: applications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get pending mentor applications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending mentor applications',
        error: error.message
      });
    }
  }

  // Get mentor application statistics
  static async getMentorApplicationStats(req, res) {
    try {
      const stats = await MentorApplication.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalApplications = await MentorApplication.countDocuments();
      const recentApplications = await MentorApplication.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      const formattedStats = {
        total: totalApplications,
        pending: stats.find(s => s._id === 'pending')?.count || 0,
        approved: stats.find(s => s._id === 'approved')?.count || 0,
        rejected: stats.find(s => s._id === 'rejected')?.count || 0,
        waitlisted: stats.find(s => s._id === 'waitlisted')?.count || 0,
        recentApplications
      };

      res.status(200).json({
        success: true,
        data: formattedStats
      });
    } catch (error) {
      console.error('Get mentor application stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get mentor application statistics',
        error: error.message
      });
    }
  }

  // Get mentor application by ID
  static async getMentorApplicationById(req, res) {
    try {
      const { id } = req.params;

      const application = await MentorApplication.findById(id)
        .populate('applicantId', 'name email phone')
        .populate('reviewedBy', 'name email');

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Mentor application not found'
        });
      }

      res.status(200).json({
        success: true,
        data: application
      });
    } catch (error) {
      console.error('Get mentor application by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get mentor application',
        error: error.message
      });
    }
  }

  // Waitlist mentor application
  static async waitlistMentorApplication(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const application = await MentorApplication.findByIdAndUpdate(
        id,
        {
          status: 'waitlisted',
          reviewedBy: req.admin.id,
          reviewedAt: new Date(),
          rejectionReason: reason || 'Application waitlisted for further review',
          updatedAt: new Date()
        },
        { new: true }
      ).populate('applicantId', 'name email');

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Mentor application not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Mentor application waitlisted successfully',
        data: application
      });
    } catch (error) {
      console.error('Waitlist mentor application error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to waitlist mentor application',
        error: error.message
      });
    }
  }

  // Get pending jobs
  static async getPendingJobs(req, res) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const skip = (page - 1) * limit;

      const jobs = await Job.find({ status: 'pending' })
        .populate('companyId', 'name logo location')
        .populate('postedBy', 'name email')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Job.countDocuments({ status: 'pending' });

      res.status(200).json({
        success: true,
        data: jobs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get pending jobs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending jobs',
        error: error.message
      });
    }
  }

  // Get job statistics
  static async getJobStats(req, res) {
    try {
      const stats = await Job.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalJobs = await Job.countDocuments();
      const featuredJobs = await Job.countDocuments({ isFeatured: true });
      const recentJobs = await Job.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });
      const expiredJobs = await Job.countDocuments({
        applicationDeadline: { $lt: new Date() }
      });

      const formattedStats = {
        total: totalJobs,
        pending: stats.find(s => s._id === 'pending')?.count || 0,
        approved: stats.find(s => s._id === 'approved')?.count || 0,
        rejected: stats.find(s => s._id === 'rejected')?.count || 0,
        featured: featuredJobs,
        recent: recentJobs,
        expired: expiredJobs
      };

      res.status(200).json({
        success: true,
        data: formattedStats
      });
    } catch (error) {
      console.error('Get job stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get job statistics',
        error: error.message
      });
    }
  }

  // Get job by ID
  static async getJobById(req, res) {
    try {
      const { id } = req.params;

      const job = await Job.findById(id)
        .populate('companyId', 'name logo location website')
        .populate('postedBy', 'name email')
        .populate('reviewedBy', 'name email');

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      res.status(200).json({
        success: true,
        data: job
      });
    } catch (error) {
      console.error('Get job by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get job',
        error: error.message
      });
    }
  }

  // Feature a job
  static async featureJob(req, res) {
    try {
      const { id } = req.params;
      const { featuredUntil } = req.body;

      const job = await Job.findByIdAndUpdate(
        id,
        {
          isFeatured: true,
          featuredAt: new Date(),
          featuredUntil: featuredUntil ? new Date(featuredUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
          updatedAt: new Date()
        },
        { new: true }
      ).populate('companyId', 'name logo');

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Job featured successfully',
        data: job
      });
    } catch (error) {
      console.error('Feature job error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to feature job',
        error: error.message
      });
    }
  }

  // Unfeature a job
  static async unfeatureJob(req, res) {
    try {
      const { id } = req.params;

      const job = await Job.findByIdAndUpdate(
        id,
        {
          isFeatured: false,
          featuredAt: null,
          featuredUntil: null,
          updatedAt: new Date()
        },
        { new: true }
      ).populate('companyId', 'name logo');

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Job unfeatured successfully',
        data: job
      });
    } catch (error) {
      console.error('Unfeature job error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unfeature job',
        error: error.message
      });
    }
  }

  // Delete job
  static async deleteJob(req, res) {
    try {
      const { id } = req.params;

      const job = await Job.findById(id);
      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      // Check if job has applications
      const applicationCount = await JobApplication.countDocuments({ jobId: id });
      if (applicationCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete job with ${applicationCount} applications. Consider archiving instead.`
        });
      }

      await Job.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Job deleted successfully'
      });
    } catch (error) {
      console.error('Delete job error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete job',
        error: error.message
      });
    }
  }

  // Company Management Methods
  
  // Get all companies
  static async getAllCompanies(req, res) {
    try {
      const { page = 1, limit = 10, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const skip = (page - 1) * limit;

      let filter = {};
      if (status) filter.status = status;
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { website: { $regex: search, $options: 'i' } }
        ];
      }

      const companies = await Company.find(filter)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Company.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: companies,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get all companies error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get companies',
        error: error.message
      });
    }
  }

  // Get pending companies
  static async getPendingCompanies(req, res) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const skip = (page - 1) * limit;

      const companies = await Company.find({ status: 'pending' })
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Company.countDocuments({ status: 'pending' });

      res.status(200).json({
        success: true,
        data: companies,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get pending companies error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending companies',
        error: error.message
      });
    }
  }

  // Get company statistics
  static async getCompanyStats(req, res) {
    try {
      const stats = await Company.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalCompanies = await Company.countDocuments();
      const verifiedCompanies = await Company.countDocuments({ isVerified: true });
      const recentCompanies = await Company.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      const formattedStats = {
        total: totalCompanies,
        pending: stats.find(s => s._id === 'pending')?.count || 0,
        approved: stats.find(s => s._id === 'approved')?.count || 0,
        rejected: stats.find(s => s._id === 'rejected')?.count || 0,
        suspended: stats.find(s => s._id === 'suspended')?.count || 0,
        verified: verifiedCompanies,
        recent: recentCompanies
      };

      res.status(200).json({
        success: true,
        data: formattedStats
      });
    } catch (error) {
      console.error('Get company stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get company statistics',
        error: error.message
      });
    }
  }

  // Get company by ID
  static async getCompanyById(req, res) {
    try {
      const { id } = req.params;

      const company = await Company.findById(id)
        .populate('reviewedBy', 'firstName lastName email');

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.status(200).json({
        success: true,
        data: company
      });
    } catch (error) {
      console.error('Get company by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get company',
        error: error.message
      });
    }
  }

  // Verify company
  static async verifyCompany(req, res) {
    try {
      const { id } = req.params;

      const company = await Company.findByIdAndUpdate(
        id,
        {
          isVerified: true,
          status: 'approved',
          verifiedAt: new Date(),
          reviewedBy: req.admin.id,
          reviewedAt: new Date(),
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Company verified successfully',
        data: company
      });
    } catch (error) {
      console.error('Verify company error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify company',
        error: error.message
      });
    }
  }

  // Reject company
  static async rejectCompany(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const company = await Company.findByIdAndUpdate(
        id,
        {
          status: 'rejected',
          rejectionReason: reason || 'Company application rejected',
          reviewedBy: req.admin.id,
          reviewedAt: new Date(),
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Company rejected successfully',
        data: company
      });
    } catch (error) {
      console.error('Reject company error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject company',
        error: error.message
      });
    }
  }

  // Suspend company
  static async suspendCompany(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const company = await Company.findByIdAndUpdate(
        id,
        {
          status: 'suspended',
          suspensionReason: reason || 'Company suspended by admin',
          suspendedAt: new Date(),
          suspendedBy: req.admin.id,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Company suspended successfully',
        data: company
      });
    } catch (error) {
      console.error('Suspend company error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to suspend company',
        error: error.message
      });
    }
  }

  // Unsuspend company
  static async unsuspendCompany(req, res) {
    try {
      const { id } = req.params;

      const company = await Company.findByIdAndUpdate(
        id,
        {
          status: 'approved',
          suspensionReason: null,
          suspendedAt: null,
          suspendedBy: null,
          unsuspendedAt: new Date(),
          unsuspendedBy: req.admin.id,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Company unsuspended successfully',
        data: company
      });
    } catch (error) {
      console.error('Unsuspend company error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unsuspend company',
        error: error.message
      });
    }
  }

  // Course Management Methods
  
  // Get all courses
  static async getAllCourses(req, res) {
    try {
      const { page = 1, limit = 10, status, category, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const skip = (page - 1) * limit;

      let filter = {};
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } }
        ];
      }

      const courses = await Course.find(filter)
        .populate('instructor', 'firstName lastName email profilePicture')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Course.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: courses,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get all courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get courses',
        error: error.message
      });
    }
  }

  // Get pending courses
  static async getPendingCourses(req, res) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const skip = (page - 1) * limit;

      const courses = await Course.find({ status: 'pending' })
        .populate('instructor', 'firstName lastName email profilePicture')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Course.countDocuments({ status: 'pending' });

      res.status(200).json({
        success: true,
        data: courses,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get pending courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending courses',
        error: error.message
      });
    }
  }

  // Get course statistics
  static async getCourseStats(req, res) {
    try {
      const stats = await Course.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalCourses = await Course.countDocuments();
      const featuredCourses = await Course.countDocuments({ isFeatured: true });
      const recentCourses = await Course.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });
      const freeCourses = await Course.countDocuments({ price: 0 });
      const paidCourses = await Course.countDocuments({ price: { $gt: 0 } });

      const formattedStats = {
        total: totalCourses,
        pending: stats.find(s => s._id === 'pending')?.count || 0,
        approved: stats.find(s => s._id === 'approved')?.count || 0,
        rejected: stats.find(s => s._id === 'rejected')?.count || 0,
        featured: featuredCourses,
        recent: recentCourses,
        free: freeCourses,
        paid: paidCourses
      };

      res.status(200).json({
        success: true,
        data: formattedStats
      });
    } catch (error) {
      console.error('Get course stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get course statistics',
        error: error.message
      });
    }
  }

  // Get course by ID
  static async getCourseById(req, res) {
    try {
      const { id } = req.params;

      const course = await Course.findById(id)
        .populate('instructor', 'firstName lastName email profilePicture')
        .populate('reviewedBy', 'firstName lastName email');

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      res.status(200).json({
        success: true,
        data: course
      });
    } catch (error) {
      console.error('Get course by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get course',
        error: error.message
      });
    }
  }

  // Approve course
  static async approveCourse(req, res) {
    try {
      const { id } = req.params;

      const course = await Course.findByIdAndUpdate(
        id,
        {
          status: 'approved',
          isPublished: true,
          publishedAt: new Date(),
          reviewedBy: req.admin.id,
          reviewedAt: new Date(),
          updatedAt: new Date()
        },
        { new: true }
      ).populate('instructor', 'firstName lastName email');

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Course approved successfully',
        data: course
      });
    } catch (error) {
      console.error('Approve course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve course',
        error: error.message
      });
    }
  }

  // Reject course
  static async rejectCourse(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const course = await Course.findByIdAndUpdate(
        id,
        {
          status: 'rejected',
          rejectionReason: reason || 'Course rejected by admin',
          reviewedBy: req.admin.id,
          reviewedAt: new Date(),
          updatedAt: new Date()
        },
        { new: true }
      ).populate('instructor', 'firstName lastName email');

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Course rejected successfully',
        data: course
      });
    } catch (error) {
      console.error('Reject course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject course',
        error: error.message
      });
    }
  }

  // Feature course
  static async featureCourse(req, res) {
    try {
      const { id } = req.params;
      const { featuredUntil } = req.body;

      const course = await Course.findByIdAndUpdate(
        id,
        {
          isFeatured: true,
          featuredAt: new Date(),
          featuredUntil: featuredUntil ? new Date(featuredUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
          updatedAt: new Date()
        },
        { new: true }
      ).populate('instructor', 'firstName lastName email');

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Course featured successfully',
        data: course
      });
    } catch (error) {
      console.error('Feature course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to feature course',
        error: error.message
      });
    }
  }

  // Unfeature course
  static async unfeatureCourse(req, res) {
    try {
      const { id } = req.params;

      const course = await Course.findByIdAndUpdate(
        id,
        {
          isFeatured: false,
          featuredAt: null,
          featuredUntil: null,
          updatedAt: new Date()
        },
        { new: true }
      ).populate('instructor', 'firstName lastName email');

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Course unfeatured successfully',
        data: course
      });
    } catch (error) {
      console.error('Unfeature course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unfeature course',
        error: error.message
      });
    }
  }

  // Delete course
  static async deleteCourse(req, res) {
    try {
      const { id } = req.params;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      // Check if course has enrollments (assuming there's an enrollment model)
      // const enrollmentCount = await Enrollment.countDocuments({ courseId: id });
      // if (enrollmentCount > 0) {
      //   return res.status(400).json({
      //     success: false,
      //     message: `Cannot delete course with ${enrollmentCount} enrollments. Consider archiving instead.`
      //   });
      // }

      await Course.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Course deleted successfully'
      });
    } catch (error) {
      console.error('Delete course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete course',
        error: error.message
      });
    }
  }

  // Booking Management Methods
  
  // Get all bookings
  static async getAllBookings(req, res) {
    try {
      const { page = 1, limit = 10, status, mentorId, userId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const skip = (page - 1) * limit;

      let filter = {};
      if (status) filter.status = status;
      if (mentorId) filter.mentorId = mentorId;
      if (userId) filter.userId = userId;

      const bookings = await Booking.find(filter)
        .populate('userId', 'firstName lastName email profilePicture')
        .populate('mentorId', 'firstName lastName email profilePicture')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Booking.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get all bookings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get bookings',
        error: error.message
      });
    }
  }

  // Get booking statistics
  static async getBookingStats(req, res) {
    try {
      const stats = await Booking.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalBookings = await Booking.countDocuments();
      const recentBookings = await Booking.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });
      const todayBookings = await Booking.countDocuments({
        bookingDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      });

      const formattedStats = {
        total: totalBookings,
        pending: stats.find(s => s._id === 'pending')?.count || 0,
        confirmed: stats.find(s => s._id === 'confirmed')?.count || 0,
        completed: stats.find(s => s._id === 'completed')?.count || 0,
        cancelled: stats.find(s => s._id === 'cancelled')?.count || 0,
        recent: recentBookings,
        today: todayBookings
      };

      res.status(200).json({
        success: true,
        data: formattedStats
      });
    } catch (error) {
      console.error('Get booking stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get booking statistics',
        error: error.message
      });
    }
  }

  // Get booking by ID
  static async getBookingById(req, res) {
    try {
      const { id } = req.params;

      const booking = await Booking.findById(id)
        .populate('userId', 'firstName lastName email profilePicture phone')
        .populate('mentorId', 'firstName lastName email profilePicture phone');

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      res.status(200).json({
        success: true,
        data: booking
      });
    } catch (error) {
      console.error('Get booking by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get booking',
        error: error.message
      });
    }
  }

  // Cancel booking
  static async cancelBooking(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const booking = await Booking.findByIdAndUpdate(
        id,
        {
          status: 'cancelled',
          cancellationReason: reason || 'Cancelled by admin',
          cancelledBy: req.admin.id,
          cancelledAt: new Date(),
          updatedAt: new Date()
        },
        { new: true }
      ).populate('userId', 'firstName lastName email')
       .populate('mentorId', 'firstName lastName email');

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Booking cancelled successfully',
        data: booking
      });
    } catch (error) {
      console.error('Cancel booking error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel booking',
        error: error.message
      });
    }
  }

  // Content Moderation Methods
  
  // Get content reports (placeholder - requires ContentReport model)
  static async getContentReports(req, res) {
    try {
      const { page = 1, limit = 10, status = 'pending', type } = req.query;
      const skip = (page - 1) * limit;

      // This is a placeholder implementation
      // You'll need to create a ContentReport model
      const reports = {
        data: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(limit)
        }
      };

      res.status(200).json({
        success: true,
        message: 'Content reports feature requires ContentReport model implementation',
        ...reports
      });
    } catch (error) {
      console.error('Get content reports error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get content reports',
        error: error.message
      });
    }
  }

  // Resolve content report (placeholder)
  static async resolveContentReport(req, res) {
    try {
      const { id } = req.params;
      const { action, reason } = req.body;

      res.status(200).json({
        success: true,
        message: 'Content report resolution requires ContentReport model implementation'
      });
    } catch (error) {
      console.error('Resolve content report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve content report',
        error: error.message
      });
    }
  }

  // Delete content (placeholder)
  static async deleteContent(req, res) {
    try {
      const { contentType, contentId } = req.params;
      const { reason } = req.body;

      res.status(200).json({
        success: true,
        message: 'Content deletion requires specific content model implementation'
      });
    } catch (error) {
      console.error('Delete content error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete content',
        error: error.message
      });
    }
  }

  // System Management Methods
  
  // Create backup (placeholder)
  static async createBackup(req, res) {
    try {
      const { type = 'full', description } = req.body;

      const backup = {
        id: new Date().getTime().toString(),
        type,
        description: description || `${type} backup created by admin`,
        createdBy: req.admin.id,
        createdAt: new Date(),
        status: 'completed',
        size: '0 MB' // Placeholder
      };

      res.status(200).json({
        success: true,
        message: 'Backup creation requires database backup service implementation',
        data: backup
      });
    } catch (error) {
      console.error('Create backup error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create backup',
        error: error.message
      });
    }
  }

  // Get backups (placeholder)
  static async getBackups(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;

      res.status(200).json({
        success: true,
        message: 'Backup listing requires backup storage service implementation',
        data: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get backups error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get backups',
        error: error.message
      });
    }
  }

  // Restore backup (placeholder)
  static async restoreBackup(req, res) {
    try {
      const { id } = req.params;

      res.status(200).json({
        success: true,
        message: 'Backup restoration requires backup service implementation'
      });
    } catch (error) {
      console.error('Restore backup error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to restore backup',
        error: error.message
      });
    }
  }

  // Get audit logs (placeholder)
  static async getAuditLogs(req, res) {
    try {
      const { page = 1, limit = 10, action, userId, startDate, endDate } = req.query;

      res.status(200).json({
        success: true,
        message: 'Audit logs require AuditLog model implementation',
        data: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get audit logs',
        error: error.message
      });
    }
  }

  // Get user audit logs (placeholder)
  static async getUserAuditLogs(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      res.status(200).json({
        success: true,
        message: 'User audit logs require AuditLog model implementation',
        data: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get user audit logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user audit logs',
        error: error.message
      });
    }
  }

  // Get admin audit logs (placeholder)
  static async getAdminAuditLogs(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;

      res.status(200).json({
        success: true,
        message: 'Admin audit logs require AuditLog model implementation',
        data: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get admin audit logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get admin audit logs',
        error: error.message
      });
    }
  }

  // Notification Management Methods
  
  // Get notifications (placeholder)
  static async getNotifications(req, res) {
    try {
      const { page = 1, limit = 10, isRead } = req.query;

      res.status(200).json({
        success: true,
        message: 'Notifications require Notification model implementation',
        data: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications',
        error: error.message
      });
    }
  }

  // Send notification (placeholder)
  static async sendNotification(req, res) {
    try {
      const { recipients, title, message, type = 'info' } = req.body;

      res.status(200).json({
        success: true,
        message: 'Notification sending requires notification service implementation'
      });
    } catch (error) {
      console.error('Send notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send notification',
        error: error.message
      });
    }
  }

  // Mark notification as read (placeholder)
  static async markNotificationAsRead(req, res) {
    try {
      const { id } = req.params;

      res.status(200).json({
        success: true,
        message: 'Notification marking requires Notification model implementation'
      });
    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: error.message
      });
    }
  }

  // Delete notification (placeholder)
  static async deleteNotification(req, res) {
    try {
      const { id } = req.params;

      res.status(200).json({
        success: true,
        message: 'Notification deletion requires Notification model implementation'
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: error.message
      });
    }
  }

  // Permissions & Roles Management Methods
  
  // Get all permissions (placeholder)
  static async getAllPermissions(req, res) {
    try {
      const permissions = [
        { id: '1', name: 'user.read', description: 'Read user data' },
        { id: '2', name: 'user.write', description: 'Write user data' },
        { id: '3', name: 'admin.read', description: 'Read admin data' },
        { id: '4', name: 'admin.write', description: 'Write admin data' },
        { id: '5', name: 'course.read', description: 'Read course data' },
        { id: '6', name: 'course.write', description: 'Write course data' },
        { id: '7', name: 'job.read', description: 'Read job data' },
        { id: '8', name: 'job.write', description: 'Write job data' }
      ];

      res.status(200).json({
        success: true,
        message: 'Permissions require Permission model implementation',
        data: permissions
      });
    } catch (error) {
      console.error('Get all permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get permissions',
        error: error.message
      });
    }
  }

  // Create permission (placeholder)
  static async createPermission(req, res) {
    try {
      const { name, description } = req.body;

      const permission = {
        id: new Date().getTime().toString(),
        name,
        description,
        createdBy: req.admin.id,
        createdAt: new Date()
      };

      res.status(201).json({
        success: true,
        message: 'Permission creation requires Permission model implementation',
        data: permission
      });
    } catch (error) {
      console.error('Create permission error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create permission',
        error: error.message
      });
    }
  }

  // Update permission (placeholder)
  static async updatePermission(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      res.status(200).json({
        success: true,
        message: 'Permission update requires Permission model implementation'
      });
    } catch (error) {
      console.error('Update permission error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update permission',
        error: error.message
      });
    }
  }

  // Delete permission (placeholder)
  static async deletePermission(req, res) {
    try {
      const { id } = req.params;

      res.status(200).json({
        success: true,
        message: 'Permission deletion requires Permission model implementation'
      });
    } catch (error) {
      console.error('Delete permission error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete permission',
        error: error.message
      });
    }
  }

  // Get all roles (placeholder)
  static async getAllRoles(req, res) {
    try {
      const roles = [
        { id: '1', name: 'admin', description: 'Full system access', permissions: ['user.read', 'user.write', 'admin.read', 'admin.write'] },
        { id: '2', name: 'mentor', description: 'Mentor access', permissions: ['user.read', 'course.read', 'course.write'] },
        { id: '3', name: 'user', description: 'Basic user access', permissions: ['user.read'] }
      ];

      res.status(200).json({
        success: true,
        message: 'Roles require Role model implementation',
        data: roles
      });
    } catch (error) {
      console.error('Get all roles error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get roles',
        error: error.message
      });
    }
  }

  // Create role (placeholder)
  static async createRole(req, res) {
    try {
      const { name, description, permissions } = req.body;

      const role = {
        id: new Date().getTime().toString(),
        name,
        description,
        permissions: permissions || [],
        createdBy: req.admin.id,
        createdAt: new Date()
      };

      res.status(201).json({
        success: true,
        message: 'Role creation requires Role model implementation',
        data: role
      });
    } catch (error) {
      console.error('Create role error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create role',
        error: error.message
      });
    }
  }

  // Update role (placeholder)
  static async updateRole(req, res) {
    try {
      const { id } = req.params;
      const { name, description, permissions } = req.body;

      res.status(200).json({
        success: true,
        message: 'Role update requires Role model implementation'
      });
    } catch (error) {
      console.error('Update role error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update role',
        error: error.message
      });
    }
  }

  // Delete role (placeholder)
  static async deleteRole(req, res) {
    try {
      const { id } = req.params;

      res.status(200).json({
        success: true,
        message: 'Role deletion requires Role model implementation'
      });
    } catch (error) {
      console.error('Delete role error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete role',
        error: error.message
      });
    }
  }

  // Admin activation/deactivation (for admin management)
  static async activateAdmin(req, res) {
    try {
      const { id } = req.params;
      
      const admin = await Admin.findById(id);
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }
      
      admin.isActive = true;
      admin.deactivatedAt = null;
      await admin.save();
      
      res.json({
        success: true,
        message: 'Admin activated successfully',
        data: {
          id: admin._id,
          email: admin.email,
          isActive: admin.isActive
        }
      });
    } catch (error) {
      console.error('Error activating admin:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async deactivateAdmin(req, res) {
    try {
      const { id } = req.params;
      
      // Prevent self-deactivation
      if (req.admin.id === id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account'
        });
      }
      
      const admin = await Admin.findById(id);
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }
      
      admin.isActive = false;
      admin.deactivatedAt = new Date();
      // Clear refresh tokens to force logout
      admin.refreshTokens = [];
      await admin.save();
      
      res.json({
        success: true,
        message: 'Admin deactivated successfully',
        data: {
          id: admin._id,
          email: admin.email,
          isActive: admin.isActive
        }
      });
    } catch (error) {
      console.error('Error deactivating admin:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Report generation methods
  static async generateUserReport(req, res) {
    try {
      const { startDate, endDate, format = 'json' } = req.query;
      
      // Build date filter
      const dateFilter = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
      }
      
      // Get user statistics
      const totalUsers = await User.countDocuments(dateFilter);
      const activeUsers = await User.countDocuments({ ...dateFilter, isActive: true });
      const inactiveUsers = await User.countDocuments({ ...dateFilter, isActive: false });
      const verifiedUsers = await User.countDocuments({ ...dateFilter, isVerified: true });
      
      // Get users by role
      const usersByRole = await User.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]);
      
      // Get registration trends (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const registrationTrends = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);
      
      const report = {
        summary: {
          totalUsers,
          activeUsers,
          inactiveUsers,
          verifiedUsers,
          activationRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0,
          verificationRate: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(2) : 0
        },
        usersByRole: usersByRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        registrationTrends,
        generatedAt: new Date(),
        dateRange: { startDate, endDate }
      };
      
      if (format === 'csv') {
        // Convert to CSV format
        const csv = this.convertToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=user-report.csv');
        return res.send(csv);
      }
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generating user report:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async generateMentorReport(req, res) {
    try {
      const { startDate, endDate, format = 'json' } = req.query;
      
      // Build date filter
      const dateFilter = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
      }
      
      // Get mentor application statistics
      const totalApplications = await MentorApplication.countDocuments(dateFilter);
      const pendingApplications = await MentorApplication.countDocuments({ ...dateFilter, status: 'pending' });
      const approvedApplications = await MentorApplication.countDocuments({ ...dateFilter, status: 'approved' });
      const rejectedApplications = await MentorApplication.countDocuments({ ...dateFilter, status: 'rejected' });
      const waitlistedApplications = await MentorApplication.countDocuments({ ...dateFilter, status: 'waitlisted' });
      
      // Get applications by expertise area
      const applicationsByExpertise = await MentorApplication.aggregate([
        { $match: dateFilter },
        { $unwind: '$expertiseAreas' },
        { $group: { _id: '$expertiseAreas', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // Get approval trends
      const approvalTrends = await MentorApplication.aggregate([
        {
          $match: {
            ...dateFilter,
            status: { $in: ['approved', 'rejected'] }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$updatedAt' },
              month: { $month: '$updatedAt' },
              status: '$status'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);
      
      const report = {
        summary: {
          totalApplications,
          pendingApplications,
          approvedApplications,
          rejectedApplications,
          waitlistedApplications,
          approvalRate: totalApplications > 0 ? ((approvedApplications / totalApplications) * 100).toFixed(2) : 0,
          rejectionRate: totalApplications > 0 ? ((rejectedApplications / totalApplications) * 100).toFixed(2) : 0
        },
        applicationsByExpertise,
        approvalTrends,
        generatedAt: new Date(),
        dateRange: { startDate, endDate }
      };
      
      if (format === 'csv') {
        const csv = this.convertToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=mentor-report.csv');
        return res.send(csv);
      }
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generating mentor report:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async generateJobReport(req, res) {
    try {
      const { startDate, endDate, format = 'json' } = req.query;
      
      // Build date filter
      const dateFilter = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
      }
      
      // Get job statistics
      const totalJobs = await Job.countDocuments(dateFilter);
      const activeJobs = await Job.countDocuments({ ...dateFilter, status: 'active' });
      const pendingJobs = await Job.countDocuments({ ...dateFilter, status: 'pending' });
      const rejectedJobs = await Job.countDocuments({ ...dateFilter, status: 'rejected' });
      const expiredJobs = await Job.countDocuments({ ...dateFilter, status: 'expired' });
      const featuredJobs = await Job.countDocuments({ ...dateFilter, isFeatured: true });
      
      // Get jobs by category
      const jobsByCategory = await Job.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // Get jobs by employment type
      const jobsByType = await Job.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$employmentType', count: { $sum: 1 } } }
      ]);
      
      // Get jobs by salary range
      const jobsBySalaryRange = await Job.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lt: ['$salary.min', 30000] }, then: 'Under 30k' },
                  { case: { $lt: ['$salary.min', 50000] }, then: '30k-50k' },
                  { case: { $lt: ['$salary.min', 80000] }, then: '50k-80k' },
                  { case: { $lt: ['$salary.min', 120000] }, then: '80k-120k' }
                ],
                default: '120k+'
              }
            },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Get application statistics
      const applicationStats = await JobApplication.aggregate([
        {
          $lookup: {
            from: 'jobs',
            localField: 'jobId',
            foreignField: '_id',
            as: 'job'
          }
        },
        { $unwind: '$job' },
        { $match: { 'job.createdAt': dateFilter.createdAt || { $exists: true } } },
        {
          $group: {
            _id: null,
            totalApplications: { $sum: 1 },
            avgApplicationsPerJob: { $avg: 1 }
          }
        }
      ]);
      
      const report = {
        summary: {
          totalJobs,
          activeJobs,
          pendingJobs,
          rejectedJobs,
          expiredJobs,
          featuredJobs,
          approvalRate: totalJobs > 0 ? ((activeJobs / totalJobs) * 100).toFixed(2) : 0,
          featuredRate: totalJobs > 0 ? ((featuredJobs / totalJobs) * 100).toFixed(2) : 0
        },
        jobsByCategory,
        jobsByType,
        jobsBySalaryRange,
        applicationStats: applicationStats[0] || { totalApplications: 0, avgApplicationsPerJob: 0 },
        generatedAt: new Date(),
        dateRange: { startDate, endDate }
      };
      
      if (format === 'csv') {
        const csv = this.convertToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=job-report.csv');
        return res.send(csv);
      }
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generating job report:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async generateBookingReport(req, res) {
    try {
      const { startDate, endDate, format = 'json' } = req.query;
      
      // Build date filter
      const dateFilter = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
      }
      
      // Get booking statistics
      const totalBookings = await Booking.countDocuments(dateFilter);
      const confirmedBookings = await Booking.countDocuments({ ...dateFilter, status: 'confirmed' });
      const pendingBookings = await Booking.countDocuments({ ...dateFilter, status: 'pending' });
      const cancelledBookings = await Booking.countDocuments({ ...dateFilter, status: 'cancelled' });
      const completedBookings = await Booking.countDocuments({ ...dateFilter, status: 'completed' });
      
      // Get bookings by session type
      const bookingsByType = await Booking.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$sessionType', count: { $sum: 1 } } }
      ]);
      
      // Get booking trends (daily for last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const bookingTrends = await Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);
      
      // Get average session duration and rating
      const sessionStats = await Booking.aggregate([
        {
          $match: {
            ...dateFilter,
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$duration' },
            avgRating: { $avg: '$rating' },
            totalRevenue: { $sum: '$amount' }
          }
        }
      ]);
      
      const report = {
        summary: {
          totalBookings,
          confirmedBookings,
          pendingBookings,
          cancelledBookings,
          completedBookings,
          confirmationRate: totalBookings > 0 ? ((confirmedBookings / totalBookings) * 100).toFixed(2) : 0,
          completionRate: confirmedBookings > 0 ? ((completedBookings / confirmedBookings) * 100).toFixed(2) : 0,
          cancellationRate: totalBookings > 0 ? ((cancelledBookings / totalBookings) * 100).toFixed(2) : 0
        },
        bookingsByType,
        bookingTrends,
        sessionStats: sessionStats[0] || { avgDuration: 0, avgRating: 0, totalRevenue: 0 },
        generatedAt: new Date(),
        dateRange: { startDate, endDate }
      };
      
      if (format === 'csv') {
        const csv = this.convertToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=booking-report.csv');
        return res.send(csv);
      }
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generating booking report:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async generateRevenueReport(req, res) {
    try {
      const { startDate, endDate, format = 'json' } = req.query;
      
      // Build date filter
      const dateFilter = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
      }
      
      // Get revenue from bookings
      const bookingRevenue = await Booking.aggregate([
        {
          $match: {
            ...dateFilter,
            status: { $in: ['completed', 'confirmed'] },
            amount: { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            totalBookings: { $sum: 1 },
            avgBookingValue: { $avg: '$amount' }
          }
        }
      ]);
      
      // Get revenue trends (monthly)
      const revenueTrends = await Booking.aggregate([
        {
          $match: {
            ...dateFilter,
            status: { $in: ['completed', 'confirmed'] },
            amount: { $exists: true }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            revenue: { $sum: '$amount' },
            bookings: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);
      
      // Get revenue by session type
      const revenueByType = await Booking.aggregate([
        {
          $match: {
            ...dateFilter,
            status: { $in: ['completed', 'confirmed'] },
            amount: { $exists: true }
          }
        },
        {
          $group: {
            _id: '$sessionType',
            revenue: { $sum: '$amount' },
            bookings: { $sum: 1 },
            avgValue: { $avg: '$amount' }
          }
        },
        { $sort: { revenue: -1 } }
      ]);
      
      // Get top performing mentors by revenue
      const topMentors = await Booking.aggregate([
        {
          $match: {
            ...dateFilter,
            status: { $in: ['completed', 'confirmed'] },
            amount: { $exists: true }
          }
        },
        {
          $group: {
            _id: '$mentorId',
            revenue: { $sum: '$amount' },
            bookings: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'mentor'
          }
        },
        { $unwind: '$mentor' },
        {
          $project: {
            mentorName: '$mentor.name',
            mentorEmail: '$mentor.email',
            revenue: 1,
            bookings: 1
          }
        }
      ]);
      
      const bookingRevenueData = bookingRevenue[0] || { totalRevenue: 0, totalBookings: 0, avgBookingValue: 0 };
      
      const report = {
        summary: {
          totalRevenue: bookingRevenueData.totalRevenue,
          totalTransactions: bookingRevenueData.totalBookings,
          avgTransactionValue: bookingRevenueData.avgBookingValue,
          revenueGrowth: 0 // Would need historical data to calculate
        },
        revenueTrends,
        revenueByType,
        topMentors,
        generatedAt: new Date(),
        dateRange: { startDate, endDate }
      };
      
      if (format === 'csv') {
        const csv = this.convertToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=revenue-report.csv');
        return res.send(csv);
      }
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error generating revenue report:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Export data in various formats
  static async exportData(req, res) {
    try {
      const { type } = req.params;
      const { format = 'csv', dateRange, filters = {} } = req.body;
      
      // Validate export type
      const validTypes = ['users', 'mentors', 'jobs', 'bookings', 'companies', 'courses', 'applications'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid export type. Valid types: ${validTypes.join(', ')}`
        });
      }
      
      // Validate format
      const validFormats = ['csv', 'excel', 'pdf'];
      if (!validFormats.includes(format)) {
        return res.status(400).json({
          success: false,
          message: `Invalid format. Valid formats: ${validFormats.join(', ')}`
        });
      }
      
      // Build date filter
      const dateFilter = {};
      if (dateRange && dateRange.startDate) {
        dateFilter.createdAt = { $gte: new Date(dateRange.startDate) };
      }
      if (dateRange && dateRange.endDate) {
        if (!dateFilter.createdAt) dateFilter.createdAt = {};
        dateFilter.createdAt.$lte = new Date(dateRange.endDate);
      }
      
      // Combine filters
      const query = { ...dateFilter, ...filters };
      
      let data = [];
      let filename = '';
      
      switch (type) {
        case 'users':
          data = await User.find(query)
            .select('name email role isActive isVerified createdAt lastLoginAt')
            .lean();
          filename = `users-export-${Date.now()}`;
          break;
          
        case 'mentors':
          data = await MentorApplication.find(query)
            .populate('userId', 'name email')
            .select('userId status expertiseAreas experience hourlyRate createdAt approvedAt')
            .lean();
          filename = `mentors-export-${Date.now()}`;
          break;
          
        case 'jobs':
          data = await Job.find(query)
            .populate('companyId', 'name')
            .select('title companyId category employmentType location salary status isFeatured createdAt')
            .lean();
          filename = `jobs-export-${Date.now()}`;
          break;
          
        case 'bookings':
          try {
            data = await Booking.find(query)
              .populate('userId', 'name email')
              .populate('mentorId', 'name email')
              .select('userId mentorId sessionType status amount duration scheduledAt createdAt')
              .lean();
          } catch (error) {
            return res.status(400).json({
              success: false,
              message: 'Booking data not available'
            });
          }
          filename = `bookings-export-${Date.now()}`;
          break;
          
        case 'companies':
          try {
            data = await Company.find(query)
              .select('name email industry size location isVerified status createdAt')
              .lean();
          } catch (error) {
            return res.status(400).json({
              success: false,
              message: 'Company data not available'
            });
          }
          filename = `companies-export-${Date.now()}`;
          break;
          
        case 'courses':
          try {
            data = await Course.find(query)
              .populate('instructorId', 'name email')
              .select('title instructorId category level price status isFeatured enrollmentCount createdAt')
              .lean();
          } catch (error) {
            return res.status(400).json({
              success: false,
              message: 'Course data not available'
            });
          }
          filename = `courses-export-${Date.now()}`;
          break;
          
        case 'applications':
          try {
            data = await JobApplication.find(query)
              .populate('userId', 'name email')
              .populate('jobId', 'title')
              .select('userId jobId status appliedAt')
              .lean();
          } catch (error) {
            return res.status(400).json({
              success: false,
              message: 'Job application data not available'
            });
          }
          filename = `job-applications-export-${Date.now()}`;
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid export type'
          });
      }
      
      if (!data || data.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No data found for export'
        });
      }
      
      // Process data based on format
      switch (format) {
        case 'csv':
          const csv = this.convertToCSV(data);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
          return res.send(csv);
          
        case 'excel':
          // For Excel format, you might want to use a library like 'xlsx'
          // For now, we'll return CSV with Excel MIME type
          const excelData = this.convertToCSV(data);
          res.setHeader('Content-Type', 'application/vnd.ms-excel');
          res.setHeader('Content-Disposition', `attachment; filename=${filename}.xls`);
          return res.send(excelData);
          
        case 'pdf':
          // For PDF format, you might want to use a library like 'pdfkit' or 'puppeteer'
          // For now, we'll return JSON with instructions
          return res.json({
            success: true,
            message: 'PDF export not yet implemented. Use CSV or Excel format.',
            data: {
              totalRecords: data.length,
              exportType: type,
              generatedAt: new Date()
            }
          });
          
        default:
          return res.json({
            success: true,
            data: {
              records: data,
              totalRecords: data.length,
              exportType: type,
              format,
              generatedAt: new Date()
            }
          });
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Enhanced CSV conversion helper method
  static convertToCSV(data) {
    if (!data || data.length === 0) {
      return '';
    }
    
    // Flatten nested objects and get all possible keys
    const flattenObject = (obj, prefix = '') => {
      let result = {};
      for (let key in obj) {
        if (obj[key] === null || obj[key] === undefined) {
          result[prefix + key] = '';
        } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
          Object.assign(result, flattenObject(obj[key], prefix + key + '.'));
        } else if (Array.isArray(obj[key])) {
          result[prefix + key] = obj[key].join('; ');
        } else if (obj[key] instanceof Date) {
          result[prefix + key] = obj[key].toISOString();
        } else {
          result[prefix + key] = obj[key];
        }
      }
      return result;
    };
    
    // Flatten all objects and collect all unique keys
    const flattenedData = data.map(item => flattenObject(item));
    const allKeys = [...new Set(flattenedData.flatMap(item => Object.keys(item)))];
    
    // Create CSV header
    const header = allKeys.join(',');
    
    // Create CSV rows
    const rows = flattenedData.map(item => {
      return allKeys.map(key => {
        const value = item[key] || '';
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });
    
    return [header, ...rows].join('\n');
  }

  // Dashboard analytics
  static async getAnalytics(req, res) {
    try {
      const { period = '30d' } = req.query;
      
      // Calculate date range based on period
      const now = new Date();
      let startDate;
      
      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      // Get user analytics
      const totalUsers = await User.countDocuments();
      const newUsers = await User.countDocuments({ createdAt: { $gte: startDate } });
      const activeUsers = await User.countDocuments({ isActive: true });
      const verifiedUsers = await User.countDocuments({ isVerified: true });
      
      // Get mentor analytics
      const totalMentorApplications = await MentorApplication.countDocuments();
      const pendingMentorApplications = await MentorApplication.countDocuments({ status: 'pending' });
      const approvedMentors = await MentorApplication.countDocuments({ status: 'approved' });
      
      // Get job analytics
      const totalJobs = await Job.countDocuments();
      const activeJobs = await Job.countDocuments({ status: 'active' });
      const pendingJobs = await Job.countDocuments({ status: 'pending' });
      const newJobs = await Job.countDocuments({ createdAt: { $gte: startDate } });
      
      // Get booking analytics (if Booking model exists)
      let bookingStats = { total: 0, completed: 0, pending: 0, revenue: 0 };
      try {
        const totalBookings = await Booking.countDocuments();
        const completedBookings = await Booking.countDocuments({ status: 'completed' });
        const pendingBookings = await Booking.countDocuments({ status: 'pending' });
        
        // Calculate revenue from completed bookings
        const revenueResult = await Booking.aggregate([
          { $match: { status: 'completed', amount: { $exists: true } } },
          { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
        ]);
        
        bookingStats = {
          total: totalBookings,
          completed: completedBookings,
          pending: pendingBookings,
          revenue: revenueResult[0]?.totalRevenue || 0
        };
      } catch (error) {
        console.log('Booking model not available or error:', error.message);
      }
      
      // Get growth trends
      const userGrowthTrend = await User.aggregate([
        {
          $match: { createdAt: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);
      
      const jobGrowthTrend = await Job.aggregate([
        {
          $match: { createdAt: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);
      
      const analytics = {
        users: {
          total: totalUsers,
          new: newUsers,
          active: activeUsers,
          verified: verifiedUsers,
          growthTrend: userGrowthTrend
        },
        mentors: {
          totalApplications: totalMentorApplications,
          pending: pendingMentorApplications,
          approved: approvedMentors,
          approvalRate: totalMentorApplications > 0 ? ((approvedMentors / totalMentorApplications) * 100).toFixed(2) : 0
        },
        jobs: {
          total: totalJobs,
          active: activeJobs,
          pending: pendingJobs,
          new: newJobs,
          growthTrend: jobGrowthTrend
        },
        bookings: bookingStats,
        period,
        generatedAt: new Date()
      };
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error getting analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Recent activities
  static async getRecentActivities(req, res) {
    try {
      const { limit = 20, page = 1 } = req.query;
      const skip = (page - 1) * limit;
      
      // Get recent user registrations
      const recentUsers = await User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email createdAt role')
        .lean();
      
      // Get recent mentor applications
      const recentMentorApplications = await MentorApplication.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name email')
        .select('userId status createdAt expertiseAreas')
        .lean();
      
      // Get recent job postings
      const recentJobs = await Job.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('companyId', 'name')
        .select('title companyId status createdAt location')
        .lean();
      
      // Get recent bookings (if available)
      let recentBookings = [];
      try {
        recentBookings = await Booking.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('userId', 'name')
          .populate('mentorId', 'name')
          .select('userId mentorId status createdAt sessionType amount')
          .lean();
      } catch (error) {
        console.log('Booking model not available:', error.message);
      }
      
      // Format activities
      const activities = [];
      
      // Add user activities
      recentUsers.forEach(user => {
        activities.push({
          type: 'user_registration',
          title: 'New User Registration',
          description: `${user.name} (${user.email}) registered as ${user.role}`,
          timestamp: user.createdAt,
          data: user
        });
      });
      
      // Add mentor application activities
      recentMentorApplications.forEach(application => {
        activities.push({
          type: 'mentor_application',
          title: 'New Mentor Application',
          description: `${application.userId?.name} applied to become a mentor`,
          timestamp: application.createdAt,
          data: application
        });
      });
      
      // Add job posting activities
      recentJobs.forEach(job => {
        activities.push({
          type: 'job_posting',
          title: 'New Job Posted',
          description: `${job.title} posted by ${job.companyId?.name}`,
          timestamp: job.createdAt,
          data: job
        });
      });
      
      // Add booking activities
      recentBookings.forEach(booking => {
        activities.push({
          type: 'booking',
          title: 'New Booking',
          description: `${booking.userId?.name} booked a ${booking.sessionType} session`,
          timestamp: booking.createdAt,
          data: booking
        });
      });
      
      // Sort all activities by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Apply pagination
      const paginatedActivities = activities.slice(skip, skip + parseInt(limit));
      
      res.json({
        success: true,
        data: {
          activities: paginatedActivities,
          pagination: {
            currentPage: parseInt(page),
            totalItems: activities.length,
            totalPages: Math.ceil(activities.length / limit),
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Error getting recent activities:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // User statistics
  static async getUserStats(req, res) {
    try {
      const { period = '30d' } = req.query;
      
      // Calculate date range
      const now = new Date();
      let startDate;
      
      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      // Get basic user counts
      const totalUsers = await User.countDocuments();
      const newUsers = await User.countDocuments({ createdAt: { $gte: startDate } });
      const activeUsers = await User.countDocuments({ isActive: true });
      const inactiveUsers = await User.countDocuments({ isActive: false });
      const verifiedUsers = await User.countDocuments({ isVerified: true });
      const unverifiedUsers = await User.countDocuments({ isVerified: false });
      
      // Get users by role
      const usersByRole = await User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Get user registration trends
      const registrationTrends = await User.aggregate([
        {
          $match: { createdAt: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);
      
      // Get users by verification status over time
      const verificationTrends = await User.aggregate([
        {
          $match: { 
            verifiedAt: { $gte: startDate, $exists: true }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$verifiedAt' },
              month: { $month: '$verifiedAt' },
              day: { $dayOfMonth: '$verifiedAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);
      
      // Calculate growth rate
      const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
      const previousPeriodUsers = await User.countDocuments({
        createdAt: { $gte: previousPeriodStart, $lt: startDate }
      });
      
      const growthRate = previousPeriodUsers > 0 
        ? (((newUsers - previousPeriodUsers) / previousPeriodUsers) * 100).toFixed(2)
        : newUsers > 0 ? 100 : 0;
      
      const stats = {
        summary: {
          total: totalUsers,
          new: newUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          verified: verifiedUsers,
          unverified: unverifiedUsers,
          growthRate: parseFloat(growthRate)
        },
        breakdown: {
          byRole: usersByRole.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          byStatus: {
            active: activeUsers,
            inactive: inactiveUsers
          },
          byVerification: {
            verified: verifiedUsers,
            unverified: unverifiedUsers
          }
        },
        trends: {
          registration: registrationTrends,
          verification: verificationTrends
        },
        rates: {
          activation: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0,
          verification: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(2) : 0
        },
        period,
        generatedAt: new Date()
      };
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting user stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = AdminController;