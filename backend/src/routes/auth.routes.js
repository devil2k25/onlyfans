'use strict';

const express = require('express');
const router = express.Router();
const { register, login, getMe, refreshToken } = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me  (protected)
router.get('/me', verifyToken, getMe);

// POST /api/auth/refresh
router.post('/refresh', refreshToken);

module.exports = router;
