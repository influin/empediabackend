const Achievement = require('../models/Achievement');
const User = require('../models/User');
const mongoose = require('mongoose');

class AchievementController {
  // Get all achievements for a user
  static async getUserAchievements(req, res) {
    try {
      const userId = req.params.userId || req.user.id;
      
      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check authorization (users can only access their own achievements or public profiles)
      if (userId !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const achievements = await Achievement.findByUser(userId);
      
      res.json({
        success: true,
        count: achievements.length,
        data: achievements
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching achievements',
        error: error.message
      });
    }
  }
  
  // Get single achievement
  static async getAchievementById(req, res) {
    try {
      const achievement = await Achievement.findById(req.params.id).populate('user', 'name email');
      
      if (!achievement) {
        return res.status(404).json({
          success: false,
          message: 'Achievement not found'
        });
      }
      
      // Check authorization
      if (achievement.user._id.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      res.json({
        success: true,
        data: achievement
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching achievement',
        error: error.message
      });
    }
  }
  
  // Create new achievement
  static async createAchievement(req, res) {
    try {
      const achievementData = {
        ...req.body,
        user: req.user.id
      };
      
      const achievement = new Achievement(achievementData);
      await achievement.save();
      
      // Update user's profile completion
      const user = await User.findById(req.user.id);
      if (user) {
        await user.updateProfileCompletion();
      }
      
      await achievement.populate('user', 'name email');
      
      res.status(201).json({
        success: true,
        message: 'Achievement created successfully',
        data: achievement
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
        message: 'Error creating achievement',
        error: error.message
      });
    }
  }
  
  // Update achievement
  static async updateAchievement(req, res) {
    try {
      const achievement = await Achievement.findById(req.params.id);
      
      if (!achievement) {
        return res.status(404).json({
          success: false,
          message: 'Achievement not found'
        });
      }
      
      // Check authorization
      if (achievement.user.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // Update fields
      Object.keys(req.body).forEach(key => {
        if (key !== 'user') { // Prevent user field modification
          achievement[key] = req.body[key];
        }
      });
      
      await achievement.save();
      
      // Update user's profile completion
      const user = await User.findById(req.user.id);
      if (user) {
        await user.updateProfileCompletion();
      }
      
      await achievement.populate('user', 'name email');
      
      res.json({
        success: true,
        message: 'Achievement updated successfully',
        data: achievement
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
        message: 'Error updating achievement',
        error: error.message
      });
    }
  }
  
  // Delete achievement
  static async deleteAchievement(req, res) {
    try {
      const achievement = await Achievement.findById(req.params.id);
      
      if (!achievement) {
        return res.status(404).json({
          success: false,
          message: 'Achievement not found'
        });
      }
      
      // Check authorization
      if (achievement.user.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      await achievement.remove();
      
      res.json({
        success: true,
        message: 'Achievement deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting achievement',
        error: error.message
      });
    }
  }
  
  // Get all achievements (admin only)
  static async getAllAchievements(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      const query = {};
      
      // Add filters
      if (req.query.title) {
        query.title = new RegExp(req.query.title, 'i');
      }
      
      if (req.query.issuer) {
        query.issuer = new RegExp(req.query.issuer, 'i');
      }
      
      if (req.query.category) {
        query.category = req.query.category;
      }
      
      if (req.query.isVerified !== undefined) {
        query.isVerified = req.query.isVerified === 'true';
      }
      
      const achievements = await Achievement.find(query)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      const total = await Achievement.countDocuments(query);
      
      res.json({
        success: true,
        count: achievements.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: achievements
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching achievements',
        error: error.message
      });
    }
  }
  
  // Get achievement statistics for a user
  static async getAchievementStats(req, res) {
    try {
      const userId = req.params.userId || req.user.id;
      
      // Check authorization
      if (userId !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const stats = await Achievement.getAchievementStats(userId);
      const totalAchievements = await Achievement.countDocuments({ user: userId });
      const verifiedAchievements = await Achievement.countDocuments({ user: userId, isVerified: true });
      
      res.json({
        success: true,
        data: {
          total: totalAchievements,
          verified: verifiedAchievements,
          verificationRate: totalAchievements > 0 ? (verifiedAchievements / totalAchievements * 100).toFixed(2) : 0,
          byCategory: stats
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching achievement statistics',
        error: error.message
      });
    }
  }
  
  // Verify achievement (admin only)
  static async verifyAchievement(req, res) {
    try {
      const achievement = await Achievement.findById(req.params.id);
      
      if (!achievement) {
        return res.status(404).json({
          success: false,
          message: 'Achievement not found'
        });
      }
      
      await achievement.verify();
      
      res.json({
        success: true,
        message: 'Achievement verified successfully',
        data: achievement
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error verifying achievement',
        error: error.message
      });
    }
  }
  
  // Bulk create achievements
  static async bulkCreateAchievements(req, res) {
    try {
      const { achievements } = req.body;
      
      if (!Array.isArray(achievements) || achievements.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Achievements array is required and cannot be empty'
        });
      }
      
      // Add user ID to each achievement
      const achievementData = achievements.map(achievement => ({
        ...achievement,
        user: req.user.id
      }));
      
      const createdAchievements = await Achievement.insertMany(achievementData);
      
      // Update user's profile completion
      const user = await User.findById(req.user.id);
      if (user) {
        await user.updateProfileCompletion();
      }
      
      res.status(201).json({
        success: true,
        message: `${createdAchievements.length} achievements created successfully`,
        count: createdAchievements.length,
        data: createdAchievements
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating achievements',
        error: error.message
      });
    }
  }
}

module.exports = AchievementController;