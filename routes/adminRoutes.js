const express = require('express');
const AdminController = require('../controllers/adminController');
const { adminProtect, adminAuthorize, checkPermission } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// Validation middleware
const validateAdminLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

const validateAdminCreation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('role')
    .optional()
    .isIn(['admin', 'superAdmin'])
    .withMessage('Role must be either admin or superAdmin'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array'),
  handleValidationErrors
];

const validateAdminUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('role')
    .optional()
    .isIn(['admin', 'superAdmin'])
    .withMessage('Role must be either admin or superAdmin'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  handleValidationErrors
];

const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  handleValidationErrors
];

const validateSystemSettings = [
  body('maintenanceMode')
    .optional()
    .isBoolean()
    .withMessage('Maintenance mode must be a boolean'),
  body('allowRegistration')
    .optional()
    .isBoolean()
    .withMessage('Allow registration must be a boolean'),
  body('maxFileSize')
    .optional()
    .isNumeric()
    .withMessage('Max file size must be a number'),
  body('allowedFileTypes')
    .optional()
    .isArray()
    .withMessage('Allowed file types must be an array'),
  handleValidationErrors
];

// Public admin routes (no authentication required)
router.post('/login', validateAdminLogin, AdminController.login);
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  handleValidationErrors
], AdminController.forgotPassword);
router.post('/reset-password/:token', [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  handleValidationErrors
], AdminController.resetPassword);

// Protected admin routes (require authentication)
router.use(adminProtect); // All routes below require admin authentication

// Admin profile management
router.get('/profile', AdminController.getProfile);
router.put('/profile', validateAdminUpdate, AdminController.updateProfile);
router.post('/change-password', validatePasswordChange, AdminController.changePassword);
router.post('/logout', AdminController.logout);
router.post('/refresh-token', AdminController.refreshToken);

// Dashboard and statistics
router.get('/dashboard/stats', AdminController.getDashboardStats);
router.get('/dashboard/analytics', AdminController.getAnalytics);
router.get('/dashboard/recent-activities', AdminController.getRecentActivities);

// User management
router.get('/users', AdminController.getAllUsers);
router.get('/users/stats', AdminController.getUserStats);
router.get('/users/:id', AdminController.getUserById);
router.put('/users/:id', validateAdminUpdate, AdminController.updateUser);
router.patch('/users/:id/activate', AdminController.activateUser);
router.patch('/users/:id/deactivate', AdminController.deactivateUser);
router.delete('/users/:id', adminAuthorize('superAdmin'), AdminController.deleteUser);
router.patch('/users/:id/role', adminAuthorize('superAdmin'), [
  body('roles').isArray().withMessage('Roles must be an array'),
  handleValidationErrors
], AdminController.updateUserRole);

// Admin management (super admin only)
router.get('/admins', adminAuthorize('superAdmin'), AdminController.getAllAdmins);
router.post('/admins', adminAuthorize('superAdmin'), validateAdminCreation, AdminController.createAdmin);
router.get('/admins/:id', adminAuthorize('superAdmin'), AdminController.getAdminById);
router.put('/admins/:id', adminAuthorize('superAdmin'), validateAdminUpdate, AdminController.updateAdmin);
router.patch('/admins/:id/activate', adminAuthorize('superAdmin'), AdminController.activateAdmin);
router.patch('/admins/:id/deactivate', adminAuthorize('superAdmin'), AdminController.deactivateAdmin);
router.delete('/admins/:id', adminAuthorize('superAdmin'), AdminController.deleteAdmin);

// Mentor application management
router.get('/mentor-applications', AdminController.getAllMentorApplications);
router.get('/mentor-applications/pending', AdminController.getPendingMentorApplications);
router.get('/mentor-applications/stats', AdminController.getMentorApplicationStats);
router.get('/mentor-applications/:id', AdminController.getMentorApplicationById);
router.patch('/mentor-applications/:id/approve', AdminController.approveMentorApplication);
router.patch('/mentor-applications/:id/reject', [
  body('rejectionReason').notEmpty().withMessage('Rejection reason is required'),
  handleValidationErrors
], AdminController.rejectMentorApplication);
router.patch('/mentor-applications/:id/waitlist', AdminController.waitlistMentorApplication);

// Job management
router.get('/jobs', AdminController.getAllJobs);
router.get('/jobs/pending', AdminController.getPendingJobs);
router.get('/jobs/stats', AdminController.getJobStats);
router.get('/jobs/:id', AdminController.getJobById);
router.patch('/jobs/:id/approve', AdminController.approveJob);
router.patch('/jobs/:id/reject', [
  body('rejectionReason').notEmpty().withMessage('Rejection reason is required'),
  handleValidationErrors
], AdminController.rejectJob);
router.patch('/jobs/:id/feature', AdminController.featureJob);
router.patch('/jobs/:id/unfeature', AdminController.unfeatureJob);
router.delete('/jobs/:id', AdminController.deleteJob);

// Company management
router.get('/companies', AdminController.getAllCompanies);
router.get('/companies/pending', AdminController.getPendingCompanies);
router.get('/companies/stats', AdminController.getCompanyStats);
router.get('/companies/:id', AdminController.getCompanyById);
router.patch('/companies/:id/verify', AdminController.verifyCompany);
router.patch('/companies/:id/reject', [
  body('rejectionReason').notEmpty().withMessage('Rejection reason is required'),
  handleValidationErrors
], AdminController.rejectCompany);
router.patch('/companies/:id/suspend', AdminController.suspendCompany);
router.patch('/companies/:id/unsuspend', AdminController.unsuspendCompany);

// Course management
router.get('/courses', AdminController.getAllCourses);
router.get('/courses/pending', AdminController.getPendingCourses);
router.get('/courses/stats', AdminController.getCourseStats);
router.get('/courses/:id', AdminController.getCourseById);
router.patch('/courses/:id/approve', AdminController.approveCourse);
router.patch('/courses/:id/reject', [
  body('rejectionReason').notEmpty().withMessage('Rejection reason is required'),
  handleValidationErrors
], AdminController.rejectCourse);
router.patch('/courses/:id/feature', AdminController.featureCourse);
router.patch('/courses/:id/unfeature', AdminController.unfeatureCourse);
router.delete('/courses/:id', AdminController.deleteCourse);

// Booking management
router.get('/bookings', AdminController.getAllBookings);
router.get('/bookings/stats', AdminController.getBookingStats);
router.get('/bookings/:id', AdminController.getBookingById);
router.patch('/bookings/:id/cancel', [
  body('cancellationReason').notEmpty().withMessage('Cancellation reason is required'),
  handleValidationErrors
], AdminController.cancelBooking);

// Content management
router.get('/content/reports', AdminController.getContentReports);
router.patch('/content/reports/:id/resolve', AdminController.resolveContentReport);
router.delete('/content/:type/:id', AdminController.deleteContent); // type: user, job, course, etc.

// System settings (super admin only)
router.get('/settings', adminAuthorize('superAdmin'), AdminController.getSystemSettings);
router.put('/settings', adminAuthorize('superAdmin'), validateSystemSettings, AdminController.updateSystemSettings);
router.post('/settings/backup', adminAuthorize('superAdmin'), AdminController.createBackup);
router.get('/settings/backups', adminAuthorize('superAdmin'), AdminController.getBackups);
router.post('/settings/restore/:backupId', adminAuthorize('superAdmin'), AdminController.restoreBackup);

// Audit logs
router.get('/audit-logs', AdminController.getAuditLogs);
router.get('/audit-logs/user/:userId', AdminController.getUserAuditLogs);
router.get('/audit-logs/admin/:adminId', AdminController.getAdminAuditLogs);

// Notifications
router.get('/notifications', AdminController.getNotifications);
router.post('/notifications/send', [
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('recipients').isArray().withMessage('Recipients must be an array'),
  handleValidationErrors
], AdminController.sendNotification);
router.patch('/notifications/:id/read', AdminController.markNotificationAsRead);
router.delete('/notifications/:id', AdminController.deleteNotification);

// Reports and exports
router.get('/reports/users', AdminController.generateUserReport);
router.get('/reports/mentors', AdminController.generateMentorReport);
router.get('/reports/jobs', AdminController.generateJobReport);
router.get('/reports/bookings', AdminController.generateBookingReport);
router.get('/reports/revenue', AdminController.generateRevenueReport);
router.post('/export/:type', [
  body('format').isIn(['csv', 'excel', 'pdf']).withMessage('Format must be csv, excel, or pdf'),
  body('dateRange').optional().isObject().withMessage('Date range must be an object'),
  handleValidationErrors
], AdminController.exportData);

// Permissions management (super admin only)
router.get('/permissions', adminAuthorize('superAdmin'), AdminController.getAllPermissions);
router.post('/permissions', adminAuthorize('superAdmin'), [
  body('name').notEmpty().withMessage('Permission name is required'),
  body('description').notEmpty().withMessage('Permission description is required'),
  body('resource').notEmpty().withMessage('Resource is required'),
  body('action').notEmpty().withMessage('Action is required'),
  handleValidationErrors
], AdminController.createPermission);
router.put('/permissions/:id', adminAuthorize('superAdmin'), AdminController.updatePermission);
router.delete('/permissions/:id', adminAuthorize('superAdmin'), AdminController.deletePermission);

// Role management (super admin only)
router.get('/roles', adminAuthorize('superAdmin'), AdminController.getAllRoles);
router.post('/roles', adminAuthorize('superAdmin'), [
  body('name').notEmpty().withMessage('Role name is required'),
  body('description').notEmpty().withMessage('Role description is required'),
  body('permissions').isArray().withMessage('Permissions must be an array'),
  handleValidationErrors
], AdminController.createRole);
router.put('/roles/:id', adminAuthorize('superAdmin'), AdminController.updateRole);
router.delete('/roles/:id', adminAuthorize('superAdmin'), AdminController.deleteRole);

module.exports = router;