const Experience = require('../models/Experience');
const User = require('../models/User');
const mongoose = require('mongoose');

class ExperienceController {
  // Get all experience records for a user
  static async getUserExperience(req, res) {
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
      
      // Check authorization (users can only access their own experience or public profiles)
      if (userId !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const experience = await Experience.findByUser(userId);
      
      res.json({
        success: true,
        count: experience.length,
        data: experience
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching experience records',
        error: error.message
      });
    }
  }
  
  // Get single experience record
  static async getExperienceById(req, res) {
    try {
      const experience = await Experience.findById(req.params.id).populate('user', 'name email');
      
      if (!experience) {
        return res.status(404).json({
          success: false,
          message: 'Experience record not found'
        });
      }
      
      // Check authorization
      if (experience.user._id.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      res.json({
        success: true,
        data: experience
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching experience record',
        error: error.message
      });
    }
  }
  
  // Create new experience record
  static async createExperience(req, res) {
    try {
      const experienceData = {
        ...req.body,
        user: req.user.id
      };
      
      const experience = new Experience(experienceData);
      await experience.save();
      
      // Update user's profile completion
      const user = await User.findById(req.user.id);
      if (user) {
        await user.updateProfileCompletion();
      }
      
      await experience.populate('user', 'name email');
      
      res.status(201).json({
        success: true,
        message: 'Experience record created successfully',
        data: experience
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
        message: 'Error creating experience record',
        error: error.message
      });
    }
  }
  
  // Update experience record
  static async updateExperience(req, res) {
    try {
      const experience = await Experience.findById(req.params.id);
      
      if (!experience) {
        return res.status(404).json({
          success: false,
          message: 'Experience record not found'
        });
      }
      
      // Check authorization
      if (experience.user.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // Update fields
      Object.keys(req.body).forEach(key => {
        if (key !== 'user') { // Prevent user field modification
          experience[key] = req.body[key];
        }
      });
      
      await experience.save();
      
      // Update user's profile completion
      const user = await User.findById(req.user.id);
      if (user) {
        await user.updateProfileCompletion();
      }
      
      await experience.populate('user', 'name email');
      
      res.json({
        success: true,
        message: 'Experience record updated successfully',
        data: experience
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
        message: 'Error updating experience record',
        error: error.message
      });
    }
  }
  
  // Delete experience record
  static async deleteExperience(req, res) {
    try {
      const experience = await Experience.findById(req.params.id);
      
      if (!experience) {
        return res.status(404).json({
          success: false,
          message: 'Experience record not found'
        });
      }
      
      // Check authorization
      if (experience.user.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      await experience.remove();
      
      res.json({
        success: true,
        message: 'Experience record deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting experience record',
        error: error.message
      });
    }
  }
  
  // Get all experience records (admin only)
  static async getAllExperience(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      const query = {};
      
      // Add filters
      if (req.query.company) {
        query.company = new RegExp(req.query.company, 'i');
      }
      
      if (req.query.position) {
        query.position = new RegExp(req.query.position, 'i');
      }
      
      if (req.query.skill) {
        query.skills = { $in: [new RegExp(req.query.skill, 'i')] };
      }
      
      if (req.query.isCurrentlyWorking !== undefined) {
        query.isCurrentlyWorking = req.query.isCurrentlyWorking === 'true';
      }
      
      const experience = await Experience.find(query)
        .populate('user', 'name email')
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(limit);
      
      const total = await Experience.countDocuments(query);
      
      res.json({
        success: true,
        count: experience.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: experience
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching experience records',
        error: error.message
      });
    }
  }
  
  // Bulk create experience records
  static async bulkCreateExperience(req, res) {
    try {
      const { experiences } = req.body;
      
      if (!Array.isArray(experiences) || experiences.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Experiences array is required and cannot be empty'
        });
      }
      
      // Add user ID to each experience
      const experienceData = experiences.map(exp => ({
        ...exp,
        user: req.user.id
      }));
      
      const createdExperiences = await Experience.insertMany(experienceData);
      
      // Update user's profile completion
      const user = await User.findById(req.user.id);
      if (user) {
        await user.updateProfileCompletion();
      }
      
      res.status(201).json({
        success: true,
        message: `${createdExperiences.length} experience records created successfully`,
        count: createdExperiences.length,
        data: createdExperiences
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
        message: 'Error creating experience records',
        error: error.message
      });
    }
  }
}

module.exports = ExperienceController;