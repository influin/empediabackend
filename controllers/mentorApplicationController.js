const MentorApplication = require('../models/MentorApplication');

const User = require('../models/User');

class MentorApplicationController {
  // Get all mentor applications with filtering, pagination, and sorting
  static async getAllApplications(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        sortBy = 'submittedAt',
        sortOrder = 'desc',
        search,
        experienceYears,
        expertise
      } = req.query;

      // Build filter object
      const filter = { isActive: true };
      
      if (status) {
        filter.status = status;
      }
      
      if (experienceYears) {
        filter.experienceYears = { $gte: parseInt(experienceYears) };
      }
      
      if (expertise) {
        filter.expertise = { $in: Array.isArray(expertise) ? expertise : [expertise] };
      }
      
      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      let query = MentorApplication.find(filter)
        .populate('applicantId', 'name email profileImage')
        .populate('reviewedBy', 'name email')
        .populate('education')
        .populate('workExperience')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));
      
      // Add search functionality using populated user data
      if (search) {
        query = MentorApplication.aggregate([
          {
            $lookup: {
              from: 'users',
              localField: 'applicantId',
              foreignField: '_id',
              as: 'applicant'
            }
          },
          {
            $match: {
              $and: [
                filter,
                {
                  $or: [
                    { 'applicant.name': { $regex: search, $options: 'i' } },
                    { 'applicant.email': { $regex: search, $options: 'i' } },
                    { company: { $regex: search, $options: 'i' } },
                    { currentPosition: { $regex: search, $options: 'i' } },
                    { expertise: { $in: [new RegExp(search, 'i')] } },
                    { skills: { $in: [new RegExp(search, 'i')] } }
                  ]
                }
              ]
            }
          },
          { $sort: sort },
          { $skip: skip },
          { $limit: parseInt(limit) },
          {
            $lookup: {
              from: 'users',
              localField: 'reviewedBy',
              foreignField: '_id',
              as: 'reviewer'
            }
          },
          {
            $lookup: {
              from: 'educations',
              localField: 'education',
              foreignField: '_id',
              as: 'education'
            }
          },
          {
            $lookup: {
              from: 'experiences',
              localField: 'workExperience',
              foreignField: '_id',
              as: 'workExperience'
            }
          }
        ]);
      }
      
      const applications = await query;
      const total = await MentorApplication.countDocuments(filter);
      const totalPages = Math.ceil(total / parseInt(limit));

      res.status(200).json({
        success: true,
        data: applications,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
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

  // Get mentor application by ID
  static async getApplicationById(req, res) {
    try {
      const { id } = req.params;
      
      const application = await MentorApplication.findById(id)
        .populate('applicantId', 'name email profileImage phone')
        .populate('reviewedBy', 'name email')
        .populate('education')
        .populate('workExperience');

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
      res.status(500).json({
        success: false,
        message: 'Error fetching mentor application',
        error: error.message
      });
    }
  }

  // Create new mentor application
  static async createApplication(req, res) {
    try {
      const applicationData = req.body;
      
      // Check if user already has an application
      const existingApplication = await MentorApplication.findOne({
        applicantId: applicationData.applicantId,
        isActive: true
      });
      
      if (existingApplication) {
        return res.status(400).json({
          success: false,
          message: 'User already has an active mentor application'
        });
      }
      
      // Check if user exists
      const user = await User.findById(applicationData.applicantId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check if user is already a mentor
      const existingMentor = await Mentor.findOne({ userId: applicationData.applicantId });
      if (existingMentor) {
        return res.status(400).json({
          success: false,
          message: 'User is already a mentor'
        });
      }

      const application = new MentorApplication(applicationData);
      await application.save();
      
      await application.populate('applicantId', 'name email profileImage');

      res.status(201).json({
        success: true,
        message: 'Mentor application submitted successfully',
        data: application
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error creating mentor application',
        error: error.message
      });
    }
  }

  // Update mentor application
  static async updateApplication(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Remove fields that shouldn't be updated directly
      delete updateData.applicantId;
      delete updateData.status;
      delete updateData.reviewedAt;
      delete updateData.reviewedBy;
      delete updateData.submittedAt;
      
      const application = await MentorApplication.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).populate('applicantId', 'name email profileImage')
       .populate('education')
       .populate('workExperience');

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Mentor application not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Mentor application updated successfully',
        data: application
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error updating mentor application',
        error: error.message
      });
    }
  }

  // Approve mentor application
  static async approveApplication(req, res) {
    try {
      const { id } = req.params;
      const { reviewerId } = req.body;
      
      const application = await MentorApplication.findById(id)
        .populate('applicantId', 'name email profileImage');
        
      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Mentor application not found'
        });
      }
      
      if (application.status !== 'pending' && application.status !== 'underReview') {
        return res.status(400).json({
          success: false,
          message: 'Application cannot be approved in current status'
        });
      }
      
      await application.approve(reviewerId);
      
      // Create mentor profile from approved application
      const mentorData = {
        userId: application.applicantId._id,
        name: application.applicantId.name,
        position: application.currentPosition,
        imageUrl: application.applicantId.profileImage || 'https://via.placeholder.com/150',
        bio: application.bio,
        expertise: application.expertise,
        skills: application.skills,
        experienceYears: application.experienceYears,
        company: application.company,
        linkedinUrl: application.linkedinUrl,
        availableSessions: application.availableSessionTypes.map(session => ({
          type: session.type,
          duration: session.duration,
          price: session.price,
          description: session.description
        })),
        languages: application.languages,
        timezone: application.timezone,
        verificationStatus: 'verified'
      };
      
      const mentor = new Mentor(mentorData);
      await mentor.save();
      
      await application.populate('reviewedBy', 'name email');

      res.status(200).json({
        success: true,
        message: 'Mentor application approved successfully',
        data: {
          application,
          mentor
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error approving mentor application',
        error: error.message
      });
    }
  }

  // Delete mentor application (soft delete)
  static async deleteApplication(req, res) {
    try {
      const { id } = req.params;
      
      const application = await MentorApplication.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Mentor application not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Mentor application deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting mentor application',
        error: error.message
      });
    }
  }

  // Get applications by user ID
  static async getApplicationsByUserId(req, res) {
    try {
      const { userId } = req.params;
      
      const applications = await MentorApplication.find({
        applicantId: userId,
        isActive: true
      })
      .populate('reviewedBy', 'name email')
      .populate('education')
      .populate('workExperience')
      .sort({ submittedAt: -1 });

      res.status(200).json({
        success: true,
        data: applications
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user applications',
        error: error.message
      });
    }
  }

  // Reject mentor application
  static async rejectApplication(req, res) {
    try {
      const { id } = req.params;
      const { reviewerId, rejectionReason } = req.body;
      
      const application = await MentorApplication.findById(id);
      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Mentor application not found'
        });
      }
      
      if (application.status !== 'pending' && application.status !== 'underReview') {
        return res.status(400).json({
          success: false,
          message: 'Application cannot be rejected in current status'
        });
      }
      
      await application.reject(reviewerId, rejectionReason);
      
      await application.populate('applicantId', 'name email');
      await application.populate('reviewedBy', 'name email');

      res.status(200).json({
        success: true,
        message: 'Mentor application rejected successfully',
        data: application
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error rejecting mentor application',
        error: error.message
      });
    }
  }

  // Move application to waitlist
  static async waitlistApplication(req, res) {
    try {
      const { id } = req.params;
      const { reviewerId, reason } = req.body;
      
      const application = await MentorApplication.findById(id);
      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Mentor application not found'
        });
      }
      
      await application.waitlist(reviewerId, reason);
      
      await application.populate('applicantId', 'name email');
      await application.populate('reviewedBy', 'name email');

      res.status(200).json({
        success: true,
        message: 'Mentor application moved to waitlist successfully',
        data: application
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error moving application to waitlist',
        error: error.message
      });
    }
  }

  // Update application status to under review
  static async markUnderReview(req, res) {
    try {
      const { id } = req.params;
      const { reviewerId } = req.body;
      
      const application = await MentorApplication.findByIdAndUpdate(
        id,
        { 
          status: 'underReview',
          reviewedBy: reviewerId
        },
        { new: true }
      )
      .populate('applicantId', 'name email')
      .populate('reviewedBy', 'name email');

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Mentor application not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Application marked as under review',
        data: application
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error updating application status',
        error: error.message
      });
    }
  }

  // Get application statistics
  static async getApplicationStatistics(req, res) {
    try {
      const stats = await MentorApplication.getApplicationStatistics();
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching application statistics',
        error: error.message
      });
    }
  }

  // Get application enums
  static async getApplicationEnums(req, res) {
    try {
      const enums = {
        statuses: ['pending', 'underReview', 'approved', 'rejected', 'waitlisted'],
        sessionTypes: ['1:1 Video Call', 'Mock Interview', 'Document Review', 'Text Consultation'],
        durations: ['30min', '60min', '90min', '120min']
      };
      
      res.status(200).json({
        success: true,
        data: enums
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching application enums',
        error: error.message
      });
    }
  }
}

module.exports = MentorApplicationController;