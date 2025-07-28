const Badge = require('../models/Badge');
const User = require('../models/User');

class BadgeController {
  // Get all badges
  static async getAllBadges(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        category,
        isEarned,
        userId,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const query = { isActive: true };
      
      // Add filters
      if (category) query.category = category;
      if (isEarned !== undefined) query.isEarned = isEarned === 'true';
      if (userId) query.userId = userId;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
        populate: {
          path: 'userId',
          select: 'name email'
        }
      };

      const badges = await Badge.find(query)
        .populate(options.populate)
        .sort(options.sort)
        .limit(options.limit * 1)
        .skip((options.page - 1) * options.limit);

      const total = await Badge.countDocuments(query);

      res.json({
        success: true,
        count: badges.length,
        total,
        page: options.page,
        pages: Math.ceil(total / options.limit),
        data: badges
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching badges',
        error: error.message
      });
    }
  }

  // Get badge by ID
  static async getBadgeById(req, res) {
    try {
      const badge = await Badge.findById(req.params.id)
        .populate('userId', 'name email');
      
      if (!badge) {
        return res.status(404).json({
          success: false,
          message: 'Badge not found'
        });
      }

      res.json({
        success: true,
        data: badge
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid badge ID format'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error fetching badge',
        error: error.message
      });
    }
  }

  // Create new badge
  static async createBadge(req, res) {
    try {
      // Verify user exists
      const userExists = await User.findById(req.body.userId);
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const badge = new Badge(req.body);
      await badge.save();
      
      await badge.populate('userId', 'name email');

      res.status(201).json({
        success: true,
        message: 'Badge created successfully',
        data: badge
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
        message: 'Error creating badge',
        error: error.message
      });
    }
  }

  // Update badge
  static async updateBadge(req, res) {
    try {
      const badge = await Badge.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      ).populate('userId', 'name email');
      
      if (!badge) {
        return res.status(404).json({
          success: false,
          message: 'Badge not found'
        });
      }

      res.json({
        success: true,
        message: 'Badge updated successfully',
        data: badge
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
          message: 'Invalid badge ID format'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating badge',
        error: error.message
      });
    }
  }

  // Delete badge (soft delete)
  static async deleteBadge(req, res) {
    try {
      const badge = await Badge.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );
      
      if (!badge) {
        return res.status(404).json({
          success: false,
          message: 'Badge not found'
        });
      }

      res.json({
        success: true,
        message: 'Badge deleted successfully'
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid badge ID format'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error deleting badge',
        error: error.message
      });
    }
  }

  // Get badges by user ID
  static async getBadgesByUserId(req, res) {
    try {
      const { category, isEarned } = req.query;
      const query = { userId: req.params.userId, isActive: true };
      
      if (category) query.category = category;
      if (isEarned !== undefined) query.isEarned = isEarned === 'true';

      const badges = await Badge.find(query)
        .sort({ createdAt: -1 })
        .populate('userId', 'name email');

      res.json({
        success: true,
        count: badges.length,
        data: badges
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user badges',
        error: error.message
      });
    }
  }

  // Mark badge as earned
  static async markBadgeAsEarned(req, res) {
    try {
      const badge = await Badge.findById(req.params.id);
      
      if (!badge) {
        return res.status(404).json({
          success: false,
          message: 'Badge not found'
        });
      }

      if (badge.isEarned) {
        return res.status(400).json({
          success: false,
          message: 'Badge is already earned'
        });
      }

      await badge.markAsEarned();
      await badge.populate('userId', 'name email');

      res.json({
        success: true,
        message: 'Badge marked as earned successfully',
        data: badge
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error marking badge as earned',
        error: error.message
      });
    }
  }

  // Update badge progress
  static async updateBadgeProgress(req, res) {
    try {
      const { progress } = req.body;
      const badge = await Badge.findById(req.params.id);
      
      if (!badge) {
        return res.status(404).json({
          success: false,
          message: 'Badge not found'
        });
      }

      if (badge.isEarned) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update progress for already earned badge'
        });
      }

      await badge.updateProgress(progress);
      await badge.populate('userId', 'name email');

      res.json({
        success: true,
        message: 'Badge progress updated successfully',
        data: badge
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating badge progress',
        error: error.message
      });
    }
  }

  // Get badge categories
  static async getBadgeCategories(req, res) {
    try {
      const categories = Badge.getCategories();
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching badge categories',
        error: error.message
      });
    }
  }

  // Get badge statistics
  static async getBadgeStatistics(req, res) {
    try {
      const { userId } = req.params;
      
      const stats = await Badge.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId), isActive: true } },
        {
          $group: {
            _id: null,
            totalBadges: { $sum: 1 },
            earnedBadges: {
              $sum: { $cond: [{ $eq: ['$isEarned', true] }, 1, 0] }
            },
            categoryCounts: {
              $push: {
                category: '$category',
                isEarned: '$isEarned'
              }
            }
          }
        }
      ]);

      const categoryStats = await Badge.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId), isActive: true } },
        {
          $group: {
            _id: '$category',
            total: { $sum: 1 },
            earned: {
              $sum: { $cond: [{ $eq: ['$isEarned', true] }, 1, 0] }
            }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          overview: stats[0] || { totalBadges: 0, earnedBadges: 0 },
          byCategory: categoryStats
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching badge statistics',
        error: error.message
      });
    }
  }
}

module.exports = BadgeController;