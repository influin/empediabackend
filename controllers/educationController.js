const Education = require('../models/Education');
const User = require('../models/User');
const mongoose = require('mongoose');

class EducationController {
  // Get all education records for a user
  static async getUserEducation(req, res) {
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
      
      // Check authorization (users can only access their own education or public profiles)
      if (userId !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const education = await Education.findByUser(userId);
      
      res.json({
        success: true,
        count: education.length,
        data: education
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching education records',
        error: error.message
      });
    }
  }
  
  // Get single education record
  static async getEducationById(req, res) {
    try {
      const education = await Education.findById(req.params.id).populate('user', 'name email');
      
      if (!education) {
        return res.status(404).json({
          success: false,
          message: 'Education record not found'
        });
      }
      
      // Check authorization
      if (education.user._id.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      res.json({
        success: true,
        data: education
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid education ID format'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error fetching education record',
        error: error.message
      });
    }
  }
  
  // Create new education record
  static async createEducation(req, res) {
    try {
      const userId = req.params.userId || req.user.id;
      
      // Check authorization
      if (userId !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      const educationData = {
        ...req.body,
        user: userId
      };
      
      const education = new Education(educationData);
      await education.save();
      
      // Add education reference to user
      await User.findByIdAndUpdate(
        userId,
        { $push: { education: education._id } },
        { new: true }
      );
      
      // Recalculate profile completion
      user.calculateProfileCompletion();
      await user.save();
      
      await education.populate('user', 'name email');
      
      res.status(201).json({
        success: true,
        message: 'Education record created successfully',
        data: education
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation Error',
          errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating education record',
        error: error.message
      });
    }
  }
  
  // Update education record
  static async updateEducation(req, res) {
    try {
      const education = await Education.findById(req.params.id);
      
      if (!education) {
        return res.status(404).json({
          success: false,
          message: 'Education record not found'
        });
      }
      
      // Check authorization
      if (education.user.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const updatedEducation = await Education.findByIdAndUpdate(
        req.params.id,
        req.body,
        { 
          new: true, 
          runValidators: true 
        }
      ).populate('user', 'name email');
      
      res.json({
        success: true,
        message: 'Education record updated successfully',
        data: updatedEducation
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation Error',
          errors
        });
      }
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid education ID format'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating education record',
        error: error.message
      });
    }
  }
  
  // Delete education record
  static async deleteEducation(req, res) {
    try {
      const education = await Education.findById(req.params.id);
      
      if (!education) {
        return res.status(404).json({
          success: false,
          message: 'Education record not found'
        });
      }
      
      // Check authorization
      if (education.user.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // Remove education reference from user
      await User.findByIdAndUpdate(
        education.user,
        { $pull: { education: education._id } }
      );
      
      await Education.findByIdAndDelete(req.params.id);
      
      // Recalculate profile completion
      const user = await User.findById(education.user);
      if (user) {
        user.calculateProfileCompletion();
        await user.save();
      }
      
      res.json({
        success: true,
        message: 'Education record deleted successfully',
        data: education
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid education ID format'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error deleting education record',
        error: error.message
      });
    }
  }
  
  // Bulk create education records
  static async bulkCreateEducation(req, res) {
    try {
      const userId = req.params.userId || req.user.id;
      const { educationRecords } = req.body;
      
      // Check authorization
      if (userId !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      if (!Array.isArray(educationRecords) || educationRecords.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Education records array is required'
        });
      }
      
      // Add user reference to each record
      const educationData = educationRecords.map(record => ({
        ...record,
        user: userId
      }));
      
      const createdEducation = await Education.insertMany(educationData);
      
      // Add education references to user
      const educationIds = createdEducation.map(edu => edu._id);
      await User.findByIdAndUpdate(
        userId,
        { $push: { education: { $each: educationIds } } }
      );
      
      // Recalculate profile completion
      const user = await User.findById(userId);
      if (user) {
        user.calculateProfileCompletion();
        await user.save();
      }
      
      res.status(201).json({
        success: true,
        message: `${createdEducation.length} education records created successfully`,
        count: createdEducation.length,
        data: createdEducation
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation Error',
          errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating education records',
        error: error.message
      });
    }
  }
}

module.exports = EducationController;