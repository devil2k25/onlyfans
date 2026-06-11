'use strict';

const express = require('express');
const router = express.Router();
const {
  createSubscriptionCheckout,
  createTip,
  getPaymentHistory,
  stripeWebhook,
  onboardCreator,
} = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/auth');

// POST /api/payments/webhook  (raw body — no JSON parser)
// NOTE: must be registered BEFORE the json body parser in app.js
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// POST /api/payments/subscribe/:creatorId  (protected)
router.post('/subscribe/:creatorId', verifyToken, createSubscriptionCheckout);

// POST /api/payments/tip/:creatorId  (protected)
router.post('/tip/:creatorId', verifyToken, createTip);

// GET /api/payments/history  (protected)
router.get('/history', verifyToken, getPaymentHistory);

// GET /api/payments/onboard  (protected)
router.get('/onboard', verifyToken, onboardCreator);

module.exports = router;
