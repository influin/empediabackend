const Job = require('../models/Job');
const User = require('../models/User');

class JobController {
  // Get all jobs with filtering and pagination
  static async getAllJobs(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        location,
        jobType,
        experienceLevel,
        isRemote,
        skills,
        company,
        salaryRange,
        postedWithin, // days
        status = 'active', // NEW: Filter by status
        isUrgent, // NEW: Filter urgent jobs
        minBudget, // NEW: Budget filtering
        maxBudget, // NEW: Budget filtering
        benefits, // NEW: Benefits filtering
        sortBy = 'postedDate',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object - Updated to use status instead of isActive
      const filter = { status: status || 'active' };

      // Text search
      if (search) {
        filter.$text = { $search: search };
      }

      // Location filter
      if (location) {
        filter.$or = [
          { location: new RegExp(location, 'i') },
          { isRemote: true }
        ];
      }

      // Job type filter
      if (jobType) {
        filter.jobType = jobType;
      }

      // Experience level filter
      if (experienceLevel) {
        filter.experienceLevel = experienceLevel;
      }

      // Remote filter
      if (isRemote !== undefined) {
        filter.isRemote = isRemote === 'true';
      }

      // Skills filter
      if (skills) {
        const skillsArray = skills.split(',').map(skill => skill.trim().toLowerCase());
        filter.skills = { $in: skillsArray };
      }

      // Company filter
      if (company) {
        filter.company = new RegExp(company, 'i');
      }

      // NEW: Urgent jobs filter
      if (isUrgent !== undefined) {
        filter.isUrgent = isUrgent === 'true';
      }

      // NEW: Budget range filter
      if (minBudget !== undefined || maxBudget !== undefined) {
        filter.budget = {};
        if (minBudget !== undefined) filter.budget.$gte = parseFloat(minBudget);
        if (maxBudget !== undefined) filter.budget.$lte = parseFloat(maxBudget);
      }

      // NEW: Benefits filter
      if (benefits) {
        const benefitsArray = benefits.split(',').map(benefit => benefit.trim());
        filter.benefits = { $in: benefitsArray };
      }

      // Posted within filter
      if (postedWithin) {
        const days = parseInt(postedWithin);
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - days);
        filter.postedDate = { $gte: dateThreshold };
      }

      // Check for expired jobs (only for active status)
      if (status === 'active') {
        filter.$or = [
          { applicationDeadline: { $gte: new Date() } },
          { applicationDeadline: null }
        ];
      }

      // Sort options
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const jobs = await Job.find(filter)
        .populate('postedBy', 'name email')
        .populate('recommendedCourses', 'title description')
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      // Add bookmark status for authenticated users
      if (req.user) {
        jobs.forEach(job => {
          job.isBookmarked = job.bookmarkedBy.includes(req.user.id);
        });
      }

      const total = await Job.countDocuments(filter);

      res.json({
        success: true,
        data: {
          jobs,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
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

  // Get job by ID
  static async getJobById(req, res) {
    try {
      const job = await Job.findById(req.params.id)
        .populate('postedBy', 'name email')
        .populate('recommendedCourses')
        .populate('applicants.user', 'name email');

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      // Increment views
      await job.incrementViews();

      // Add bookmark status for authenticated users
      if (req.user) {
        job.isBookmarked = job.isBookmarkedBy(req.user.id);
        job.hasApplied = job.hasApplied(req.user.id);
      }

      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching job',
        error: error.message
      });
    }
  }

  // Create new job (requires authentication)
  static async createJob(req, res) {
    try {
      // NEW: Auto-populate poster information from authenticated user
      const jobData = {
        ...req.body,
        postedBy: req.user.id,
        posterName: req.user.name,
        posterEmail: req.user.email
      };

      const job = new Job(jobData);
      await job.save();

      await job.populate('postedBy', 'name email');

      res.status(201).json({
        success: true,
        message: 'Job created successfully',
        data: job
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error creating job',
        error: error.message
      });
    }
  }

  // Update job (only by job poster or admin)
  static async updateJob(req, res) {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      // Check authorization
      if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this job'
        });
      }

      Object.assign(job, req.body);
      await job.save();

      await job.populate('postedBy', 'name email');

      res.json({
        success: true,
        message: 'Job updated successfully',
        data: job
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error updating job',
        error: error.message
      });
    }
  }

  // Delete job (only by job poster or admin)
  static async deleteJob(req, res) {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      // Check authorization
      if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete this job'
        });
      }

      await Job.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'Job deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting job',
        error: error.message
      });
    }
  }

  // NEW: Job Status Management Methods
  
  // Approve job (admin only)
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
        message: 'Job approved successfully',
        data: job
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error approving job'
      });
    }
  }

  // Activate job
  static async activateJob(req, res) {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      // Check authorization
      if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to activate this job'
        });
      }

      await job.activate();

      res.json({
        success: true,
        message: 'Job activated successfully',
        data: job
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error activating job'
      });
    }
  }

  // Pause job
  static async pauseJob(req, res) {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      // Check authorization
      if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to pause this job'
        });
      }

      await job.pause();

      res.json({
        success: true,
        message: 'Job paused successfully',
        data: job
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error pausing job'
      });
    }
  }

  // Close job
  static async closeJob(req, res) {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      // Check authorization
      if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to close this job'
        });
      }

      await job.close();

      res.json({
        success: true,
        message: 'Job closed successfully',
        data: job
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error closing job'
      });
    }
  }

  // Reject job (admin only)
  static async rejectJob(req, res) {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      await job.reject();

      res.json({
        success: true,
        message: 'Job rejected successfully',
        data: job
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error rejecting job'
      });
    }
  }

  // Get pending jobs (admin only)
  static async getPendingJobs(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const jobs = await Job.find({ status: 'pending' })
        .populate('postedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Job.countDocuments({ status: 'pending' });

      res.json({
        success: true,
        data: {
          jobs,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching pending jobs',
        error: error.message
      });
    }
  }

  // Get urgent jobs
  static async getUrgentJobs(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const jobs = await Job.find({ isUrgent: true, status: 'active' })
        .populate('postedBy', 'name email')
        .sort({ postedDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Job.countDocuments({ isUrgent: true, status: 'active' });

      res.json({
        success: true,
        data: {
          jobs,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching urgent jobs',
        error: error.message
      });
    }
  }

  // Toggle bookmark (existing method - no changes needed)
  static async toggleBookmark(req, res) {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      const isBookmarked = job.isBookmarkedBy(req.user.id);

      if (isBookmarked) {
        await job.removeBookmark(req.user.id);
      } else {
        await job.addBookmark(req.user.id);
      }

      res.json({
        success: true,
        message: isBookmarked ? 'Bookmark removed' : 'Job bookmarked',
        data: {
          isBookmarked: !isBookmarked,
          bookmarkCount: job.bookmarkCount
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error toggling bookmark',
        error: error.message
      });
    }
  }

  // Apply for job (updated to check job status)
  static async applyForJob(req, res) {
    try {
      const job = await Job.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      if (job.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Job is not active for applications'
        });
      }

      if (job.isExpired) {
        return res.status(400).json({
          success: false,
          message: 'Application deadline has passed'
        });
      }

      await job.addApplication(req.user.id);

      res.json({
        success: true,
        message: 'Application submitted successfully',
        data: {
          applicationCount: job.applicationCount
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error applying for job'
      });
    }
  }

  // Get user's bookmarked jobs (updated filter)
  static async getBookmarkedJobs(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const jobs = await Job.find({ 
        bookmarkedBy: req.user.id,
        status: 'active' // Updated filter
      })
        .populate('postedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Job.countDocuments({ 
        bookmarkedBy: req.user.id,
        status: 'active'
      });

      res.json({
        success: true,
        data: {
          jobs: jobs.map(job => ({ ...job.toObject(), isBookmarked: true })),
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching bookmarked jobs',
        error: error.message
      });
    }
  }

  // Get user's applied jobs (no changes needed)
  static async getAppliedJobs(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const jobs = await Job.find({ 
        'applicants.user': req.user.id 
      })
        .populate('postedBy', 'name email')
        .sort({ 'applicants.appliedAt': -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Add application status
      const jobsWithStatus = jobs.map(job => {
        const application = job.applicants.find(app => app.user.toString() === req.user.id);
        return {
          ...job.toObject(),
          applicationStatus: application.status,
          appliedAt: application.appliedAt
        };
      });

      const total = await Job.countDocuments({ 
        'applicants.user': req.user.id 
      });

      res.json({
        success: true,
        data: {
          jobs: jobsWithStatus,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching applied jobs',
        error: error.message
      });
    }
  }

  // Get jobs posted by user (updated to show all statuses)
  static async getMyJobs(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      
      const filter = { postedBy: req.user.id };
      if (status) {
        filter.status = status;
      }

      const jobs = await Job.find(filter)
        .populate('applicants.user', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Job.countDocuments(filter);

      res.json({
        success: true,
        data: {
          jobs,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching your jobs',
        error: error.message
      });
    }
  }

  // Get job statistics (enhanced)
  static async getJobStats(req, res) {
    try {
      const stats = await Job.getJobStats();
      
      res.json({
        success: true,
        data: stats[0] || {
          totalJobs: 0,
          activeJobs: 0,
          pendingJobs: 0,
          urgentJobs: 0,
          remoteJobs: 0,
          avgViews: 0,
          avgBudget: 0,
          jobsByType: [],
          jobsByLevel: [],
          jobsByStatus: []
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching job statistics',
        error: error.message
      });
    }
  }

  // Get recommended jobs for user (updated filter)
  static async getRecommendedJobs(req, res) {
    try {
      const user = await User.findById(req.user.id).populate('skills');
      const userSkills = user.skills || [];
      
      const recommendedJobs = await Job.find({
        skills: { $in: userSkills },
        status: 'active', // Updated filter
        postedBy: { $ne: req.user.id },
        'applicants.user': { $ne: req.user.id }
      })
        .populate('postedBy', 'name email')
        .sort({ postedDate: -1 })
        .limit(10);

      res.json({
        success: true,
        data: recommendedJobs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching recommended jobs',
        error: error.message
      });
    }
  }
}

module.exports = JobController;