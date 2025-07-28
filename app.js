const express = require('express');
const connectDB = require('./config/database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/admin', require('./routes/adminRoutes'));
app.use('/api/v1/users', require('./routes/userRoutes'));
app.use('/api/v1/education', require('./routes/educationRoutes'));
app.use('/api/v1/experience', require('./routes/experienceRoutes'));
app.use('/api/v1/achievements', require('./routes/achievementRoutes'));
app.use('/api/v1/certifications', require('./routes/certificationRoutes'));
app.use('/api/v1/jobs', require('./routes/jobRoutes'));
app.use('/api/v1/badges', require('./routes/badgeRoutes'));
app.use('/api/v1/bookings', require('./routes/bookingRoutes'));
app.use('/api/v1/job-applications', require('./routes/jobApplicationRoutes'));
app.use('/api/v1/courses', require('./routes/courseRoutes'));
app.use('/api/v1/course-creations', require('./routes/courseCreationRoutes'));
app.use('/api/v1/lesson-creations', require('./routes/lessonCreationRoutes'));
app.use('/api/v1/mentor-applications', require('./routes/mentorApplicationRoutes'));

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to the Node.js API with MongoDB',
    database: 'Connected to MongoDB Atlas'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;