const express = require('express');
const router = express.Router();
const CertificationController = require('../controllers/certificationController');
const { protect, authorize } = require('../middleware/auth');
const { 
  validateCertification, 
  validateBulkCertifications, 
  handleValidationErrors 
} = require('../middleware/certificationValidation');

// All routes require authentication
router.use(protect);

// Certification CRUD routes
router.route('/')
  .get(authorize('admin'), CertificationController.getAllCertifications)
  .post(validateCertification, handleValidationErrors, CertificationController.createCertification);

// Bulk operations
router.post('/bulk', 
  validateBulkCertifications, 
  handleValidationErrors, 
  CertificationController.bulkCreateCertifications
);

// User-specific certification routes
router.get('/user/:userId', CertificationController.getUserCertifications);
router.get('/my-certifications', CertificationController.getUserCertifications);
router.get('/active/:userId?', CertificationController.getActiveCertifications);
router.get('/expiring/:userId?', CertificationController.getExpiringCertifications);
router.get('/stats/:userId?', CertificationController.getCertificationStats);

// Admin management routes
router.patch('/:id/verify', authorize('admin'), CertificationController.verifyCertification);
router.patch('/:id/revoke', authorize('admin'), CertificationController.revokeCertification);

// Individual certification routes
router.route('/:id')
  .get(CertificationController.getCertificationById)
  .put(validateCertification, handleValidationErrors, CertificationController.updateCertification)
  .delete(CertificationController.deleteCertification);

module.exports = router;