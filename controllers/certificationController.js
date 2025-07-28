const Certification = require('../models/Certification');
const User = require('../models/User');
const mongoose = require('mongoose');

class CertificationController {
  // Get all certifications for a user
  static async getUserCertifications(req, res) {
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
      
      // Check authorization
      if (userId !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const certifications = await Certification.findByUser(userId);
      
      res.json({
        success: true,
        count: certifications.length,
        data: certifications
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching certifications',
        error: error.message
      });
    }
  }
  
  // Get single certification
  static async getCertificationById(req, res) {
    try {
      const certification = await Certification.findById(req.params.id).populate('user', 'name email');
      
      if (!certification) {
        return res.status(404).json({
          success: false,
          message: 'Certification not found'
        });
      }
      
      // Check authorization
      if (certification.user._id.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      res.json({
        success: true,
        data: certification
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching certification',
        error: error.message
      });
    }
  }
  
  // Create new certification
  static async createCertification(req, res) {
    try {
      const certificationData = {
        ...req.body,
        user: req.user.id
      };
      
      const certification = new Certification(certificationData);
      await certification.save();
      
      // Update user's profile completion
      const user = await User.findById(req.user.id);
      if (user) {
        await user.updateProfileCompletion();
      }
      
      await certification.populate('user', 'name email');
      
      res.status(201).json({
        success: true,
        message: 'Certification created successfully',
        data: certification
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
        message: 'Error creating certification',
        error: error.message
      });
    }
  }
  
  // Update certification
  static async updateCertification(req, res) {
    try {
      const certification = await Certification.findById(req.params.id);
      
      if (!certification) {
        return res.status(404).json({
          success: false,
          message: 'Certification not found'
        });
      }
      
      // Check authorization
      if (certification.user.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // Update fields
      Object.keys(req.body).forEach(key => {
        if (key !== 'user') { // Prevent user field modification
          certification[key] = req.body[key];
        }
      });
      
      await certification.save();
      
      // Update user's profile completion
      const user = await User.findById(req.user.id);
      if (user) {
        await user.updateProfileCompletion();
      }
      
      await certification.populate('user', 'name email');
      
      res.json({
        success: true,
        message: 'Certification updated successfully',
        data: certification
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
        message: 'Error updating certification',
        error: error.message
      });
    }
  }
  
  // Delete certification
  static async deleteCertification(req, res) {
    try {
      const certification = await Certification.findById(req.params.id);
      
      if (!certification) {
        return res.status(404).json({
          success: false,
          message: 'Certification not found'
        });
      }
      
      // Check authorization
      if (certification.user.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      await certification.remove();
      
      res.json({
        success: true,
        message: 'Certification deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting certification',
        error: error.message
      });
    }
  }
  
  // Get all certifications (admin only)
  static async getAllCertifications(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      const query = {};
      
      // Add filters
      if (req.query.name) {
        query.name = new RegExp(req.query.name, 'i');
      }
      
      if (req.query.issuer) {
        query.issuer = new RegExp(req.query.issuer, 'i');
      }
      
      if (req.query.category) {
        query.category = req.query.category;
      }
      
      if (req.query.status) {
        query.status = req.query.status;
      }
      
      if (req.query.isVerified !== undefined) {
        query.isVerified = req.query.isVerified === 'true';
      }
      
      const certifications = await Certification.find(query)
        .populate('user', 'name email')
        .sort({ issueDate: -1 })
        .skip(skip)
        .limit(limit);
      
      const total = await Certification.countDocuments(query);
      
      res.json({
        success: true,
        count: certifications.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: certifications
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching certifications',
        error: error.message
      });
    }
  }
  
  // Get active certifications for a user
  static async getActiveCertifications(req, res) {
    try {
      const userId = req.params.userId || req.user.id;
      
      // Check authorization
      if (userId !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const certifications = await Certification.findActive(userId);
      
      res.json({
        success: true,
        count: certifications.length,
        data: certifications
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching active certifications',
        error: error.message
      });
    }
  }
  
  // Get expiring certifications
  static async getExpiringCertifications(req, res) {
    try {
      const userId = req.params.userId || req.user.id;
      const days = parseInt(req.query.days) || 30;
      
      // Check authorization
      if (userId !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const certifications = await Certification.findExpiring(userId, days);
      
      res.json({
        success: true,
        count: certifications.length,
        message: `Certifications expiring in the next ${days} days`,
        data: certifications
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching expiring certifications',
        error: error.message
      });
    }
  }
  
  // Get certification statistics
  static async getCertificationStats(req, res) {
    try {
      const userId = req.params.userId || req.user.id;
      
      // Check authorization
      if (userId !== req.user.id.toString() && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const stats = await Certification.getCertificationStats(userId);
      const totalCertifications = await Certification.countDocuments({ user: userId });
      const activeCertifications = await Certification.countDocuments({ user: userId, status: 'active' });
      const expiredCertifications = await Certification.countDocuments({ user: userId, status: 'expired' });
      const verifiedCertifications = await Certification.countDocuments({ user: userId, isVerified: true });
      
      res.json({
        success: true,
        data: {
          total: totalCertifications,
          active: activeCertifications,
          expired: expiredCertifications,
          verified: verifiedCertifications,
          verificationRate: totalCertifications > 0 ? (verifiedCertifications / totalCertifications * 100).toFixed(2) : 0,
          byCategory: stats
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching certification statistics',
        error: error.message
      });
    }
  }
  
  // Verify certification (admin only)
  static async verifyCertification(req, res) {
    try {
      const certification = await Certification.findById(req.params.id);
      
      if (!certification) {
        return res.status(404).json({
          success: false,
          message: 'Certification not found'
        });
      }
      
      await certification.verify();
      
      res.json({
        success: true,
        message: 'Certification verified successfully',
        data: certification
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error verifying certification',
        error: error.message
      });
    }
  }
  
  // Revoke certification (admin only)
  static async revokeCertification(req, res) {
    try {
      const certification = await Certification.findById(req.params.id);
      
      if (!certification) {
        return res.status(404).json({
          success: false,
          message: 'Certification not found'
        });
      }
      
      await certification.revoke();
      
      res.json({
        success: true,
        message: 'Certification revoked successfully',
        data: certification
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error revoking certification',
        error: error.message
      });
    }
  }
  
  // Bulk create certifications
  static async bulkCreateCertifications(req, res) {
    try {
      const { certifications } = req.body;
      
      if (!Array.isArray(certifications) || certifications.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Certifications array is required and cannot be empty'
        });
      }
      
      // Add user ID to each certification
      const certificationData = certifications.map(cert => ({
        ...cert,
        user: req.user.id
      }));
      
      const createdCertifications = await Certification.insertMany(certificationData);
      
      // Update user's profile completion
      const user = await User.findById(req.user.id);
      if (user) {
        await user.updateProfileCompletion();
      }
      
      res.status(201).json({
        success: true,
        message: `${createdCertifications.length} certifications created successfully`,
        count: createdCertifications.length,
        data: createdCertifications
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
        message: 'Error creating certifications',
        error: error.message
      });
    }
  }
}

module.exports = CertificationController;