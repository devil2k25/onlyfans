'use strict';

const path = require('path');
const { query } = require('../config/db');

const sanitizeUser = (user) => {
  const { password_hash, stripe_account_id, ...safe } = user;
  return safe;
};

// GET /api/users/:username
const getProfile = async (req, res, next) => {
  try {
    const { username } = req.params;

    const userResult = await query(
      'SELECT * FROM users WHERE username = $1',
      [username.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = sanitizeUser(userResult.rows[0]);

    // Check subscription status if requester is authenticated
    let isSubscribed = false;
    if (req.user) {
      const subResult = await query(
        `SELECT id FROM subscriptions
         WHERE subscriber_id = $1 AND creator_id = $2 AND status IN ('active','free')`,
        [req.user.id, user.id]
      );
      isSubscribed = subResult.rows.length > 0;
    }

    // Get recent posts (only free posts for non-subscribers)
    let postsQuery;
    let postsParams;

    if (req.user && (req.user.id === user.id || isSubscribed)) {
      postsQuery = `
        SELECT p.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', pm.id,
                'url', pm.url,
                'media_type', pm.media_type,
                'thumbnail_url', pm.thumbnail_url,
                'display_order', pm.display_order
              ) ORDER BY pm.display_order
            ) FILTER (WHERE pm.id IS NOT NULL),
            '[]'
          ) AS media
        FROM posts p
        LEFT JOIN post_media pm ON pm.post_id = p.id
        WHERE p.creator_id = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT 20
      `;
      postsParams = [user.id];
    } else {
      postsQuery = `
        SELECT p.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', pm.id,
                'url', pm.url,
                'media_type', pm.media_type,
                'thumbnail_url', pm.thumbnail_url,
                'display_order', pm.display_order
              ) ORDER BY pm.display_order
            ) FILTER (WHERE pm.id IS NOT NULL),
            '[]'
          ) AS media
        FROM posts p
        LEFT JOIN post_media pm ON pm.post_id = p.id
        WHERE p.creator_id = $1 AND p.is_free = TRUE
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT 20
      `;
      postsParams = [user.id];
    }

    const postsResult = await query(postsQuery, postsParams);

    return res.status(200).json({
      success: true,
      data: {
        user,
        posts: postsResult.rows,
        isSubscribed,
      },
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/me
const updateProfile = async (req, res, next) => {
  try {
    const { display_name, bio, subscription_price, is_creator } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (display_name !== undefined) {
      fields.push(`display_name = $${idx++}`);
      values.push(display_name);
    }
    if (bio !== undefined) {
      fields.push(`bio = $${idx++}`);
      values.push(bio);
    }
    if (subscription_price !== undefined) {
      const price = parseFloat(subscription_price);
      if (isNaN(price) || price < 0) {
        return res
          .status(400)
          .json({ success: false, error: 'subscription_price must be a non-negative number' });
      }
      fields.push(`subscription_price = $${idx++}`);
      values.push(price);
    }
    if (is_creator !== undefined) {
      fields.push(`is_creator = $${idx++}`);
      values.push(Boolean(is_creator));
    }

    if (fields.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: 'No fields to update' });
    }

    values.push(req.user.id);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      data: { user: sanitizeUser(result.rows[0]) },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/users/me/avatar
const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No avatar file uploaded' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;

    const result = await query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING *',
      [avatarUrl, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      data: { user: sanitizeUser(result.rows[0]) },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/users/me/cover
const updateCover = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No cover file uploaded' });
    }

    const coverUrl = `/uploads/${req.file.filename}`;

    const result = await query(
      'UPDATE users SET cover_url = $1 WHERE id = $2 RETURNING *',
      [coverUrl, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      data: { user: sanitizeUser(result.rows[0]) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/search?q=...
const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, error: 'Search query (q) is required' });
    }

    const search = `%${q.trim()}%`;

    const result = await query(
      `SELECT id, username, display_name, avatar_url, bio, is_creator, subscription_price,
              total_subscribers, total_posts
       FROM users
       WHERE username ILIKE $1 OR display_name ILIKE $1
       ORDER BY total_subscribers DESC
       LIMIT 20`,
      [search]
    );

    return res.status(200).json({
      success: true,
      data: { users: result.rows },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/creators?page=1&limit=20
const listCreators = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [countResult, creatorsResult] = await Promise.all([
      query('SELECT COUNT(*) FROM users WHERE is_creator = TRUE'),
      query(
        `SELECT id, username, display_name, avatar_url, cover_url, bio,
                subscription_price, total_subscribers, total_posts, created_at
         FROM users
         WHERE is_creator = TRUE
         ORDER BY total_subscribers DESC, created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);

    return res.status(200).json({
      success: true,
      data: {
        creators: creatorsResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:username/stats  (reachable via profile but also as standalone)
const getStats = async (req, res, next) => {
  try {
    const { username } = req.params;

    const result = await query(
      `SELECT id, username, total_subscribers, total_posts, subscription_price, is_creator
       FROM users WHERE username = $1`,
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = result.rows[0];

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          total_subscribers: user.total_subscribers,
          total_posts: user.total_posts,
          subscription_price: user.subscription_price,
          is_creator: user.is_creator,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  updateCover,
  searchUsers,
  listCreators,
  getStats,
};
