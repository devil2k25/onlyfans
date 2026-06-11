'use strict';

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { uploadMedia } = require('../middleware/upload');
const {
  createStream,
  getStreams,
  getStream,
  getCreatorStreams,
  endStream,
  deleteStream,
  getStreamChat,
  updateStreamThumbnail,
} = require('../controllers/stream.controller');

// ── Public routes ─────────────────────────────────────────────────────────────

// GET  /api/streams  — list live/scheduled streams
router.get('/', getStreams);

// GET  /api/streams/creator/:userId  — a creator's streams (all statuses)
// Must appear before /:id to avoid treating "creator" as a stream ID
router.get('/creator/:userId', getCreatorStreams);

// GET  /api/streams/:id  — single stream with creator info
router.get('/:id', getStream);

// GET  /api/streams/:id/chat  — last 100 chat messages
router.get('/:id/chat', getStreamChat);

// ── Protected routes ──────────────────────────────────────────────────────────

// POST /api/streams  — create a new stream
router.post('/', verifyToken, createStream);

// PUT  /api/streams/:id/end  — creator ends a stream
router.put('/:id/end', verifyToken, endStream);

// DELETE /api/streams/:id  — creator deletes a stream
router.delete('/:id', verifyToken, deleteStream);

// POST /api/streams/:id/thumbnail  — upload thumbnail (image only)
router.post('/:id/thumbnail', verifyToken, uploadMedia, updateStreamThumbnail);

module.exports = router;
