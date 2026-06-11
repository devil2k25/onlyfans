'use strict';

const path = require('path');
const { query } = require('../config/db');
require('dotenv').config();

const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STREAM_CREATOR_FIELDS = `
  ls.*,
  u.username        AS creator_username,
  u.display_name    AS creator_display_name,
  u.avatar_url      AS creator_avatar_url
`;

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/streams
 * Body: { title, description?, is_paid?, price_cents?, scheduled_at?, status? }
 * Creates a new live stream (defaults to 'scheduled').
 */
const createStream = async (req, res, next) => {
  try {
    const creatorId = req.user.id;
    const {
      title,
      description,
      is_paid = false,
      price_cents = 0,
      scheduled_at,
      status = 'scheduled',
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'title is required' });
    }

    if (!['scheduled', 'live'].includes(status)) {
      return res.status(400).json({ success: false, error: 'status must be "scheduled" or "live"' });
    }

    const result = await query(
      `INSERT INTO live_streams
         (creator_id, title, description, is_paid, price_cents, scheduled_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        creatorId,
        title.trim(),
        description || null,
        Boolean(is_paid),
        parseInt(price_cents, 10) || 0,
        scheduled_at || null,
        status,
      ]
    );

    return res.status(201).json({ success: true, data: { stream: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/streams
 * Lists live or scheduled streams, paginated.
 * Query params: status ('live'|'scheduled'), limit, offset
 */
const getStreams = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;

    const allowedStatuses = ['live', 'scheduled'];
    const filterStatus = status && allowedStatuses.includes(status) ? status : null;

    const params = [parseInt(limit, 10), parseInt(offset, 10)];
    let whereClause = "ls.status IN ('live', 'scheduled')";

    if (filterStatus) {
      params.push(filterStatus);
      whereClause = `ls.status = $${params.length}`;
    }

    const result = await query(
      `SELECT ${STREAM_CREATOR_FIELDS}
       FROM live_streams ls
       JOIN users u ON u.id = ls.creator_id
       WHERE ${whereClause}
       ORDER BY
         CASE WHEN ls.status = 'live' THEN 0 ELSE 1 END,
         ls.viewer_count DESC,
         ls.scheduled_at ASC
       LIMIT $1 OFFSET $2`,
      params
    );

    return res.status(200).json({
      success: true,
      data: {
        streams: result.rows,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/streams/:id
 * Returns a single stream with creator info.
 */
const getStream = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT ${STREAM_CREATOR_FIELDS}
       FROM live_streams ls
       JOIN users u ON u.id = ls.creator_id
       WHERE ls.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }

    return res.status(200).json({ success: true, data: { stream: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/streams/creator/:userId
 * Returns all streams (any status) for a creator.
 */
const getCreatorStreams = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await query(
      `SELECT ${STREAM_CREATOR_FIELDS}
       FROM live_streams ls
       JOIN users u ON u.id = ls.creator_id
       WHERE ls.creator_id = $1
       ORDER BY ls.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return res.status(200).json({
      success: true,
      data: {
        streams: result.rows,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/streams/:id/end
 * Sets stream status to 'ended' and records ended_at.
 * Only the creator can end the stream.
 */
const endStream = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const streamResult = await query('SELECT * FROM live_streams WHERE id = $1', [id]);
    if (streamResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }

    const stream = streamResult.rows[0];
    if (stream.creator_id !== userId) {
      return res.status(403).json({ success: false, error: 'Only the creator can end this stream' });
    }
    if (stream.status === 'ended') {
      return res.status(400).json({ success: false, error: 'Stream is already ended' });
    }

    const updated = await query(
      `UPDATE live_streams
       SET status = 'ended', ended_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return res.status(200).json({ success: true, data: { stream: updated.rows[0] } });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/streams/:id
 * Deletes a stream created by the authenticated user.
 */
const deleteStream = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const streamResult = await query(
      'SELECT id, creator_id FROM live_streams WHERE id = $1',
      [id]
    );
    if (streamResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }

    if (streamResult.rows[0].creator_id !== userId) {
      return res.status(403).json({ success: false, error: 'Only the creator can delete this stream' });
    }

    await query('DELETE FROM live_streams WHERE id = $1', [id]);

    return res.status(200).json({ success: true, data: { message: 'Stream deleted' } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/streams/:id/chat
 * Returns the last 100 chat messages for a stream.
 */
const getStreamChat = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify stream exists
    const streamResult = await query('SELECT id FROM live_streams WHERE id = $1', [id]);
    if (streamResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }

    const result = await query(
      `SELECT
         sc.id,
         sc.content,
         sc.created_at,
         u.id           AS user_id,
         u.username,
         u.display_name,
         u.avatar_url
       FROM stream_chat sc
       JOIN users u ON u.id = sc.user_id
       WHERE sc.stream_id = $1
       ORDER BY sc.created_at DESC
       LIMIT 100`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: { messages: result.rows.reverse() }, // chronological order
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/streams/:id/thumbnail  (protected + uploadMedia)
 * Uploads a thumbnail image for a stream.
 */
const updateStreamThumbnail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const streamResult = await query(
      'SELECT id, creator_id FROM live_streams WHERE id = $1',
      [id]
    );
    if (streamResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (streamResult.rows[0].creator_id !== userId) {
      return res.status(403).json({ success: false, error: 'Only the creator can update this stream' });
    }

    const thumbnailUrl = `/${UPLOADS_DIR}/media/${req.file.filename}`;

    const updated = await query(
      `UPDATE live_streams SET thumbnail_url = $1 WHERE id = $2 RETURNING *`,
      [thumbnailUrl, id]
    );

    return res.status(200).json({ success: true, data: { stream: updated.rows[0] } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createStream,
  getStreams,
  getStream,
  getCreatorStreams,
  endStream,
  deleteStream,
  getStreamChat,
  updateStreamThumbnail,
};
