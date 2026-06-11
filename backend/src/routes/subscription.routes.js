'use strict';

const express = require('express');
const router = express.Router();
const {
  getMySubscriptions,
  getMySubscribers,
  subscribe,
  unsubscribe,
  checkSubscription,
  freeSubscribe,
} = require('../controllers/subscription.controller');
const { verifyToken } = require('../middleware/auth');

// GET /api/subscriptions/my  (protected)
router.get('/my', verifyToken, getMySubscriptions);

// GET /api/subscriptions/subscribers  (protected, creator only)
router.get('/subscribers', verifyToken, getMySubscribers);

// GET /api/subscriptions/check/:creatorId  (protected)
router.get('/check/:creatorId', verifyToken, checkSubscription);

// POST /api/subscriptions/free/:creatorId  (protected)
router.post('/free/:creatorId', verifyToken, freeSubscribe);

// POST /api/subscriptions/:creatorId  (protected)
router.post('/:creatorId', verifyToken, subscribe);

// DELETE /api/subscriptions/:creatorId  (protected)
router.delete('/:creatorId', verifyToken, unsubscribe);

module.exports = router;
