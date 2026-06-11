'use strict';

const { query } = require('../config/db');
const path = require('path');
require('dotenv').config();

const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';

/**
 * Build a public URL for an uploaded file.
 * req is passed to determine protocol/host in production-like setups.
 */
const fileUrl = (req, filePath) => {
  if (!filePath) return null;
  // filePath is an absolute disk path; strip cwd to get relative path
  const relative = filePath.replace(process.cwd() + '/', '');
  return `${req.protocol}://${req.get('host')}/${relative}`;
};

/**
 * GET /api/users/:username
 * Returns public profile, recent posts and subscription status for the viewer.
 */
const getProfile = async (req, res, next) => {
  try {
    const { username } = req.params;

    const userResult = await query(
      `SELECT id, email, username, display_name, bio, avatar_url, cover_url,
              is_creator, subscription_price, total_subscribers, total_posts, created_at
       FROM users WHERE username = $1`,
      [username.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if viewer is subscribed
    let isSubscribed = false;
    if (req.user) {
      const subResult = await query(
        `SELECT id FROM subscriptions
         WHERE subscriber_id = $1 AND creator_id = $2
           AND status IN ('active','free')
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [req.user.id, user.id]
      );
      isSubscribed = subResult.rows.length > 0;
    }

    // Get recent posts (respect paywall)
    const postsResult = await query(
      `SELECT p.id, p.caption, p.is_free, p.likes_count, p.comments_count, p.created_at,
              json_agg(
                json_build_object(
                  'id', pm.id,
                  'url', pm.url,
                  'media_type', pm.media_type,
                  'thumbnail_url', pm.thumbnail_url,
                  'display_order', pm.display_order
                ) ORDER BY pm.display_order
              ) FILTER (WHERE pm.id IS NOT NULL) AS media
       FROM posts p
       LEFT JOIN post_media pm ON pm.post_id = p.id
       WHERE p.creator_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT 12`,
      [user.id]
    );

    const posts = postsResult.rows.map((post) => {
      if (!isSubscribed && !post.is_free && req.user?.id !== user.id) {
        return { ...post, media: null, caption: null, locked: true };
      }
      return { ...post, locked: false };
    });

    return res.status(200).json({
      success: true,
      data: { user, isSubscribed, posts },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/me  (protected)
 * Body: { display_name?, bio?, subscription_price?, is_creator? }
 */
const updateProfile = async (req, res, next) => {
  try {
    const { display_name, bio, subscription_price, is_creator } = req.body;
    const userId = req.user.id;

    const fields = [];
    const values = [];
    let idx = 1;

    if (display_name !== undefined) { fields.push(`display_name = $${idx++}`); values.push(display_name); }
    if (bio !== undefined) { fields.push(`bio = $${idx++}`); values.push(bio); }
    if (subscription_price !== undefined) {
      const price = parseFloat(subscription_price);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ success: false, error: 'subscription_price must be a non-negative number' });
      }
      fields.push(`subscription_price = $${idx++}`);
      values.push(price);
    }
    if (is_creator !== undefined) { fields.push(`is_creator = $${idx++}`); values.push(Boolean(is_creator)); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(userId);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING
         id, email, username, display_name, bio, avatar_url, cover_url,
         is_creator, subscription_price, total_subscribers, total_posts, created_at, updated_at`,
      values
    );

    return res.status(200).json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/me/avatar  (protected + uploadAvatar)
 */
const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No avatar file uploaded' });
    }

    const avatarUrl = `/${UPLOADS_DIR}/avatars/${req.file.filename}`;

    const result = await query(
      `UPDATE users SET avatar_url = $1 WHERE id = $2
       RETURNING id, email, username, display_name, bio, avatar_url, cover_url,
                 is_creator, subscription_price, total_subscribers, total_posts, created_at, updated_at`,
      [avatarUrl, req.user.id]
    );

    return res.status(200).json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/me/cover  (protected + uploadCover)
 */
const updateCover = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No cover file uploaded' });
    }

    const coverUrl = `/${UPLOADS_DIR}/covers/${req.file.filename}`;

    const result = await query(
      `UPDATE users SET cover_url = $1 WHERE id = $2
       RETURNING id, email, username, display_name, bio, avatar_url, cover_url,
                 is_creator, subscription_price, total_subscribers, total_posts, created_at, updated_at`,
      [coverUrl, req.user.id]
    );

    return res.status(200).json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/search?q=term
 */
const searchUsers = async (req, res, next) => {
  try {
    const { q = '', limit = 20, offset = 0 } = req.query;

    if (!q.trim()) {
      return res.status(400).json({ success: false, error: 'Search query q is required' });
    }

    const searchTerm = `%${q.trim()}%`;
    const result = await query(
      `SELECT id, username, display_name, avatar_url, bio, is_creator, subscription_price,
              total_subscribers, total_posts
       FROM users
       WHERE username ILIKE $1 OR display_name ILIKE $1
       ORDER BY total_subscribers DESC, username ASC
       LIMIT $2 OFFSET $3`,
      [searchTerm, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return res.status(200).json({ success: true, data: { users: result.rows } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/creators?limit=20&offset=0
 * Returns all is_creator=true users with stats, paginated.
 */
const listCreators = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await query(
      `SELECT id, username, display_name, avatar_url, cover_url, bio,
              is_creator, subscription_price, total_subscribers, total_posts, created_at
       FROM users
       WHERE is_creator = TRUE
       ORDER BY total_subscribers DESC, created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit, 10), parseInt(offset, 10)]
    );

    const countResult = await query('SELECT COUNT(*) FROM users WHERE is_creator = TRUE');
    const total = parseInt(countResult.rows[0].count, 10);

    return res.status(200).json({
      success: true,
      data: {
        creators: result.rows,
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:username/stats  — returns creator-specific stats
 * (also exposed via getProfile; this is a dedicated lightweight endpoint)
 */
const getStats = async (req, res, next) => {
  try {
    const { username } = req.params;

    const result = await query(
      `SELECT total_subscribers, total_posts, subscription_price
       FROM users WHERE username = $1`,
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, updateAvatar, updateCover, searchUsers, listCreators, getStats };
