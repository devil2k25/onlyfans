'use strict';

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
  createSession,
  getSessions,
  getSession,
  getBookings,
  createBooking,
  confirmBooking,
  cancelBooking,
  getAvailability,
  setAvailability,
} = require('../controllers/call.controller');

// ── Availability ─────────────────────────────────────────────────────────────
// Must be before /:id to avoid route shadowing

// GET  /api/calls/availability/:creatorId  — public (anyone can check a creator's slots)
router.get('/availability/:creatorId', getAvailability);

// PUT  /api/calls/availability  — protected (creator sets their own slots)
router.put('/availability', verifyToken, setAvailability);

// ── Bookings ─────────────────────────────────────────────────────────────────
// Must be before /:id to avoid route shadowing

// GET  /api/calls/bookings
router.get('/bookings', verifyToken, getBookings);

// POST /api/calls/bookings
router.post('/bookings', verifyToken, createBooking);

// PUT  /api/calls/bookings/:id/confirm
router.put('/bookings/:id/confirm', verifyToken, confirmBooking);

// PUT  /api/calls/bookings/:id/cancel
router.put('/bookings/:id/cancel', verifyToken, cancelBooking);

// ── Call Sessions ─────────────────────────────────────────────────────────────

// POST /api/calls
router.post('/', verifyToken, createSession);

// GET  /api/calls
router.get('/', verifyToken, getSessions);

// GET  /api/calls/:id
router.get('/:id', verifyToken, getSession);

module.exports = router;
