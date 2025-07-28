const JobApplication = require('../models/JobApplication');
const Job = require('../models/Job');
const User = require('../models/User');
const mongoose = require('mongoose');

// Get all job applications with filtering and pagination
exports.getAllJobApplications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      jobId,
      applicantId,
      company,
      sortBy = 'appliedAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    
    if (status) filter.status = status;
    if (jobId) filter.jobId = jobId;
    if (applicantId) filter.applicantId = applicantId;
    if (company) filter.company = new RegExp(company, 'i');

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const applications = await JobApplication.find(filter)
      .populate('jobId', 'position company location salary jobType')
      .populate('applicantId', 'firstName lastName email profilePicture')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await JobApplication.countDocuments(filter);

    res.json({
      success: true,
      data: applications,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching job applications',
      error: error.message
    });
  }
};

// Get job application by ID
exports.getJobApplicationById = async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.id)
      .populate('jobId')
      .populate('applicantId', 'firstName lastName email profilePicture');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Job application not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && 
        req.user.id !== application.applicantId.toString() &&
        req.user.id !== application.jobId.posterId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching job application',
      error: error.message
    });
  }
};

// Create new job application
exports.createJobApplication = async (req, res) => {
  try {
    const { jobId, resumeUrl, coverLetter, portfolioUrl, linkedinUrl, attachments, customFields } = req.body;

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if application deadline has passed
    if (job.applicationDeadline && new Date() > job.applicationDeadline) {
      return res.status(400).json({
        success: false,
        message: 'Application deadline has passed'
      });
    }

    // Check if user has already applied
    const existingApplication = await JobApplication.findOne({
      jobId,
      applicantId: req.user.id
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this job'
      });
    }

    const application = new JobApplication({
      jobId,
      jobTitle: job.position,
      company: job.company,
      applicantId: req.user.id,
      applicantName: `${req.user.firstName} ${req.user.lastName}`,
      applicantEmail: req.user.email,
      resumeUrl,
      coverLetter,
      portfolioUrl,
      linkedinUrl,
      attachments: attachments || [],
      customFields
    });

    await application.save();

    res.status(201).json({
      success: true,
      message: 'Job application submitted successfully',
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating job application',
      error: error.message
    });
  }
};

// Update job application
exports.updateJobApplication = async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Job application not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && req.user.id !== application.applicantId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow updates if application is in submitted status
    if (application.status !== 'submitted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update application after it has been reviewed'
      });
    }

    const allowedUpdates = ['resumeUrl', 'coverLetter', 'portfolioUrl', 'linkedinUrl', 'attachments', 'customFields'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedApplication = await JobApplication.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('jobId').populate('applicantId', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Job application updated successfully',
      data: updatedApplication
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating job application',
      error: error.message
    });
  }
};

// Delete job application
exports.deleteJobApplication = async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Job application not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && req.user.id !== application.applicantId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await JobApplication.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Job application deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting job application',
      error: error.message
    });
  }
};

// Get applications for a specific job
exports.getJobApplications = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { jobId };
    if (status) filter.status = status;

    const applications = await JobApplication.find(filter)
      .populate('applicantId', 'firstName lastName email profilePicture')
      .sort({ appliedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await JobApplication.countDocuments(filter);

    res.json({
      success: true,
      data: applications,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching job applications',
      error: error.message
    });
  }
};

// Get user's applications
exports.getUserApplications = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const filter = { applicantId: userId };
    if (status) filter.status = status;

    const applications = await JobApplication.find(filter)
      .populate('jobId', 'position company location salary jobType')
      .sort({ appliedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await JobApplication.countDocuments(filter);

    res.json({
      success: true,
      data: applications,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user applications',
      error: error.message
    });
  }
};

// Update application status
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { status, reviewerNotes } = req.body;
    
    const application = await JobApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Job application not found'
      });
    }

    // Check authorization (admin or job poster)
    const job = await Job.findById(application.jobId);
    if (req.user.role !== 'admin' && req.user.id !== job.posterId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await application.updateStatus(status, reviewerNotes);

    res.json({
      success: true,
      message: 'Application status updated successfully',
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating application status',
      error: error.message
    });
  }
};

// Schedule interview
exports.scheduleInterview = async (req, res) => {
  try {
    const { interviewDate, interviewNotes } = req.body;
    
    const application = await JobApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Job application not found'
      });
    }

    // Check authorization
    const job = await Job.findById(application.jobId);
    if (req.user.role !== 'admin' && req.user.id !== job.posterId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await application.scheduleInterview(new Date(interviewDate), interviewNotes);

    res.json({
      success: true,
      message: 'Interview scheduled successfully',
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error scheduling interview',
      error: error.message
    });
  }
};

// Withdraw application
exports.withdrawApplication = async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Job application not found'
      });
    }

    // Check authorization
    if (req.user.id !== application.applicantId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if application can be withdrawn
    if (['hired', 'rejected', 'withdrawn'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw application in current status'
      });
    }

    await application.withdraw();

    res.json({
      success: true,
      message: 'Application withdrawn successfully',
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error withdrawing application',
      error: error.message
    });
  }
};

// Get application statistics
exports.getApplicationStats = async (req, res) => {
  try {
    const stats = await JobApplication.getApplicationStats();
    
    const formattedStats = {
      total: 0,
      byStatus: {}
    };

    stats.forEach(stat => {
      formattedStats.byStatus[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    res.json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching application statistics',
      error: error.message
    });
  }
};

// Get pending applications (Admin only)
exports.getPendingApplications = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const pendingApplications = await JobApplication.find({
      status: { $in: ['submitted', 'underReview'] }
    })
    .populate('jobId', 'position company')
    .populate('applicantId', 'firstName lastName email')
    .sort({ appliedAt: 1 });

    res.json({
      success: true,
      data: pendingApplications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending applications',
      error: error.message
    });
  }
};

// Get upcoming interviews
exports.getUpcomingInterviews = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + parseInt(days));

    const interviews = await JobApplication.find({
      status: 'interviewed',
      interviewDate: {
        $gte: startDate,
        $lte: endDate
      }
    })
    .populate('jobId', 'position company')
    .populate('applicantId', 'firstName lastName email')
    .sort({ interviewDate: 1 });

    res.json({
      success: true,
      data: interviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming interviews',
      error: error.message
    });
  }
};