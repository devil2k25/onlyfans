'use strict';

const { query, getClient } = require('../config/db');
require('dotenv').config();

const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';

/**
 * GET /api/messages/conversations  (protected)
 * Returns unique conversations for req.user with other user info and last message.
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `WITH conversation_partners AS (
         SELECT DISTINCT
           CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS partner_id
         FROM messages
         WHERE sender_id = $1 OR receiver_id = $1
       ),
       last_messages AS (
         SELECT DISTINCT ON (
           CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END
         )
           id,
           sender_id,
           receiver_id,
           content,
           media_url,
           is_read,
           created_at,
           CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS partner_id
         FROM messages
         WHERE sender_id = $1 OR receiver_id = $1
         ORDER BY CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END, created_at DESC
       ),
       unread_counts AS (
         SELECT sender_id AS partner_id, COUNT(*) AS unread_count
         FROM messages
         WHERE receiver_id = $1 AND is_read = FALSE
         GROUP BY sender_id
       )
       SELECT
         u.id AS partner_id,
         u.username,
         u.display_name,
         u.avatar_url,
         lm.id AS last_message_id,
         lm.content AS last_message_content,
         lm.media_url AS last_message_media_url,
         lm.is_read AS last_message_is_read,
         lm.sender_id AS last_message_sender_id,
         lm.created_at AS last_message_created_at,
         COALESCE(uc.unread_count, 0) AS unread_count
       FROM conversation_partners cp
       JOIN users u ON u.id = cp.partner_id
       JOIN last_messages lm ON lm.partner_id = cp.partner_id
       LEFT JOIN unread_counts uc ON uc.partner_id = cp.partner_id
       ORDER BY lm.created_at DESC`,
      [userId]
    );

    return res.status(200).json({ success: true, data: { conversations: result.rows } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/messages/:userId  (protected)
 * Returns paginated messages between req.user and another user.
 */
const getMessages = async (req, res, next) => {
  try {
    const { userId: partnerId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    // Verify partner exists
    const partnerResult = await query(
      'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
      [partnerId]
    );
    if (partnerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const result = await query(
      `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.media_url, m.is_read, m.created_at,
              sender.username AS sender_username, sender.display_name AS sender_display_name,
              sender.avatar_url AS sender_avatar_url
       FROM messages m
       JOIN users sender ON sender.id = m.sender_id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, partnerId, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return res.status(200).json({
      success: true,
      data: {
        messages: result.rows.reverse(), // chronological order
        partner: partnerResult.rows[0],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/messages/:userId  (protected)
 * Body: { content?, media_url? } — at least one required
 */
const sendMessage = async (req, res, next) => {
  try {
    const { userId: receiverId } = req.params;
    const { content, media_url } = req.body;
    const senderId = req.user.id;

    if (senderId === receiverId) {
      return res.status(400).json({ success: false, error: 'Cannot send a message to yourself' });
    }

    if (!content && !media_url) {
      return res.status(400).json({ success: false, error: 'Message must have content or media_url' });
    }

    const receiverResult = await query('SELECT id FROM users WHERE id = $1', [receiverId]);
    if (receiverResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Recipient not found' });
    }

    const result = await query(
      `INSERT INTO messages (sender_id, receiver_id, content, media_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [senderId, receiverId, content || null, media_url || null]
    );

    return res.status(201).json({ success: true, data: { message: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/messages/:userId/read  (protected)
 * Marks all messages from :userId to req.user as read.
 */
const markRead = async (req, res, next) => {
  try {
    const { userId: senderId } = req.params;
    const receiverId = req.user.id;

    const result = await query(
      `UPDATE messages SET is_read = TRUE
       WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE
       RETURNING id`,
      [senderId, receiverId]
    );

    return res.status(200).json({
      success: true,
      data: { markedCount: result.rows.length },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getConversations, getMessages, sendMessage, markRead };
