const Course = require('../models/Course');
const mongoose = require('mongoose');

// Get all courses with filtering and pagination
exports.getAllCourses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      level,
      isFree,
      minRating,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (isFree !== undefined) filter.isFree = isFree === 'true';
    if (minRating) filter.rating = { $gte: parseFloat(minRating) };
    if (search) {
      filter.$text = { $search: search };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const courses = await Course.find(filter)
      .populate('createdBy', 'name email')
      .populate('mentorGuidance')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Course.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: courses,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching courses',
      error: error.message
    });
  }
};

// Get course by ID
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('mentorGuidance')
      .populate('enrolledUsers.user', 'name email');

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
    res.status(500).json({
      success: false,
      message: 'Error fetching course',
      error: error.message
    });
  }
};

// Create new course
exports.createCourse = async (req, res) => {
  try {
    const courseData = {
      ...req.body,
      createdBy: req.user.id
    };

    const course = new Course(courseData);
    await course.save();

    res.status(201).json({
      success: true,
      data: course,
      message: 'Course created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating course',
      error: error.message
    });
  }
};

// Update course
exports.updateCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is the creator or admin
    if (course.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this course'
      });
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      data: updatedCourse,
      message: 'Course updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating course',
      error: error.message
    });
  }
};

// Delete course
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user is the creator or admin
    if (course.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this course'
      });
    }

    await Course.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting course',
      error: error.message
    });
  }
};

// Enroll in course
exports.enrollInCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if already enrolled
    const existingEnrollment = course.enrolledUsers.find(
      enrollment => enrollment.user.toString() === req.user.id
    );

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'Already enrolled in this course'
      });
    }

    await course.enrollUser(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Successfully enrolled in course'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error enrolling in course',
      error: error.message
    });
  }
};

// Update course progress
exports.updateCourseProgress = async (req, res) => {
  try {
    const { progress } = req.body;
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    await course.updateProgress(req.user.id, progress);

    res.status(200).json({
      success: true,
      message: 'Progress updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating progress',
      error: error.message
    });
  }
};

// Get user's enrolled courses
exports.getUserCourses = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    const courses = await Course.find({
      'enrolledUsers.user': userId
    }).populate('createdBy', 'name email');

    const enrolledCourses = courses.map(course => {
      const enrollment = course.enrolledUsers.find(
        e => e.user.toString() === userId
      );
      
      return {
        ...course.toObject(),
        enrolledDate: enrollment.enrolledDate,
        progress: enrollment.progress,
        lastAccessed: enrollment.lastAccessed
      };
    });

    res.status(200).json({
      success: true,
      data: enrolledCourses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user courses',
      error: error.message
    });
  }
};

// Get courses by category
exports.getCoursesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const courses = await Course.find({ category })
      .populate('createdBy', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Course.countDocuments({ category });

    res.status(200).json({
      success: true,
      data: courses,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching courses by category',
      error: error.message
    });
  }
};

// Get course statistics
exports.getCourseStats = async (req, res) => {
  try {
    const stats = await Course.getCourseStats();
    const categoryStats = await Course.getCoursesByCategory();

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {},
        categories: categoryStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching course statistics',
      error: error.message
    });
  }
};

// Search courses
exports.searchCourses = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const courses = await Course.find({
      $text: { $search: q }
    }, {
      score: { $meta: 'textScore' }
    })
      .populate('createdBy', 'name email')
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Course.countDocuments({
      $text: { $search: q }
    });

    res.status(200).json({
      success: true,
      data: courses,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching courses',
      error: error.message
    });
  }
};