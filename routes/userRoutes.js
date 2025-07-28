const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');

// GET /api/users - Get all users
router.get('/', UserController.getAllUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', UserController.getUserById);

// POST /api/users - Create new user
router.post('/', UserController.createUser);

// PUT /api/users/:id - Update user
router.put('/:id', UserController.updateUser);

// DELETE /api/users/:id - Delete user
router.delete('/:id', UserController.deleteUser);

module.exports = router;