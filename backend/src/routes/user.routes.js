'use strict';

const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  updateAvatar,
  updateCover,
  searchUsers,
  listCreators,
  getStats,
} = require('../controllers/user.controller');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { uploadAvatar, uploadCover } = require('../middleware/upload');

// GET /api/users/search?q=term
router.get('/search', searchUsers);

// GET /api/users/creators
router.get('/creators', listCreators);

// PUT /api/users/me  (protected)
router.put('/me', verifyToken, updateProfile);

// POST /api/users/me/avatar  (protected + upload)
router.post('/me/avatar', verifyToken, uploadAvatar, updateAvatar);

// POST /api/users/me/cover  (protected + upload)
router.post('/me/cover', verifyToken, uploadCover, updateCover);

// GET /api/users/:username  (optional auth to determine subscription status)
router.get('/:username', optionalAuth, getProfile);

module.exports = router;
