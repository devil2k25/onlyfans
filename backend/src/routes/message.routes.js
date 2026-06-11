'use strict';

const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage, markRead } = require('../controllers/message.controller');
const { verifyToken } = require('../middleware/auth');

// GET /api/messages/conversations  (protected)
router.get('/conversations', verifyToken, getConversations);

// GET /api/messages/:userId  (protected)
router.get('/:userId', verifyToken, getMessages);

// POST /api/messages/:userId  (protected)
router.post('/:userId', verifyToken, sendMessage);

// PUT /api/messages/:userId/read  (protected)
router.put('/:userId/read', verifyToken, markRead);

module.exports = router;
