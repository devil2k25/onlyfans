'use strict';

const { query, getClient } = require('../config/db');
require('dotenv').config();

const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';

/**
 * Determine media type from mimetype string
 */
const getMediaType = (mimetype) => {
  if (mimetype.startsWith('video/')) return 'video';
  return 'image';
};

/**
 * GET /api/posts/feed  (protected)
 * Returns posts from creators the requesting user is subscribed to,
 * with media and like status, paginated.
 */
const getFeed = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;

    const result = await query(
      `SELECT
         p.id, p.caption, p.is_free, p.likes_count, p.comments_count,
         p.created_at, p.updated_at,
         u.id AS creator_id, u.username AS creator_username,
         u.display_name AS creator_display_name, u.avatar_url AS creator_avatar,
         json_agg(
           json_build_object(
             'id', pm.id,
             'url', pm.url,
             'media_type', pm.media_type,
             'thumbnail_url', pm.thumbnail_url,
             'display_order', pm.display_order
           ) ORDER BY pm.display_order
         ) FILTER (WHERE pm.id IS NOT NULL) AS media,
         EXISTS (
           SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1
         ) AS liked
       FROM posts p
       JOIN users u ON u.id = p.creator_id
       LEFT JOIN post_media pm ON pm.post_id = p.id
       WHERE p.creator_id IN (
         SELECT creator_id FROM subscriptions
         WHERE subscriber_id = $1
           AND status IN ('active','free')
           AND (expires_at IS NULL OR expires_at > NOW())
       )
       GROUP BY p.id, u.id
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return res.status(200).json({
      success: true,
      data: {
        posts: result.rows,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/posts/creator/:userId
 * Returns posts by a creator. Non-subscribed viewers only see free posts.
 */
const getCreatorPosts = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const viewerId = req.user ? req.user.id : null;

    // Check subscription status
    let isSubscribed = false;
    const isOwner = viewerId === userId;

    if (viewerId && !isOwner) {
      const subResult = await query(
        `SELECT id FROM subscriptions
         WHERE subscriber_id = $1 AND creator_id = $2
           AND status IN ('active','free')
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [viewerId, userId]
      );
      isSubscribed = subResult.rows.length > 0;
    }

    const showAllPosts = isOwner || isSubscribed;

    const result = await query(
      `SELECT
         p.id, p.caption, p.is_free, p.likes_count, p.comments_count,
         p.created_at, p.updated_at,
         json_agg(
           json_build_object(
             'id', pm.id,
             'url', pm.url,
             'media_type', pm.media_type,
             'thumbnail_url', pm.thumbnail_url,
             'display_order', pm.display_order
           ) ORDER BY pm.display_order
         ) FILTER (WHERE pm.id IS NOT NULL) AS media,
         ${viewerId ? `EXISTS (SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = '${viewerId}') AS liked` : 'FALSE AS liked'}
       FROM posts p
       LEFT JOIN post_media pm ON pm.post_id = p.id
       WHERE p.creator_id = $1
         ${showAllPosts ? '' : 'AND p.is_free = TRUE'}
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit, 10), parseInt(offset, 10)]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM posts WHERE creator_id = $1 ${showAllPosts ? '' : 'AND is_free = TRUE'}`,
      [userId]
    );

    const posts = result.rows.map((post) => ({
      ...post,
      locked: !showAllPosts && !post.is_free,
    }));

    return res.status(200).json({
      success: true,
      data: {
        posts,
        total: parseInt(countResult.rows[0].count, 10),
        isSubscribed,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/posts  (protected + uploadMedia)
 * Body (form-data): caption?, is_free?, media[]
 */
const createPost = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { caption, is_free = false } = req.body;
    const creatorId = req.user.id;

    const postResult = await client.query(
      `INSERT INTO posts (creator_id, caption, is_free)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [creatorId, caption || null, is_free === 'true' || is_free === true]
    );

    const post = postResult.rows[0];

    // Insert media files
    const mediaRows = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const mediaType = getMediaType(file.mimetype);
        const url = `/${UPLOADS_DIR}/media/${file.filename}`;

        const mediaResult = await client.query(
          `INSERT INTO post_media (post_id, url, media_type, display_order)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [post.id, url, mediaType, i]
        );
        mediaRows.push(mediaResult.rows[0]);
      }
    }

    // Increment total_posts
    await client.query(
      'UPDATE users SET total_posts = total_posts + 1 WHERE id = $1',
      [creatorId]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      data: { post: { ...post, media: mediaRows } },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/posts/:id  (protected)
 */
const deletePost = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const userId = req.user.id;

    const postResult = await client.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (postResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    if (postResult.rows[0].creator_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, error: 'Not authorized to delete this post' });
    }

    await client.query('DELETE FROM posts WHERE id = $1', [id]);

    // Decrement total_posts (floor at 0)
    await client.query(
      'UPDATE users SET total_posts = GREATEST(total_posts - 1, 0) WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');

    return res.status(200).json({ success: true, data: { message: 'Post deleted successfully' } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

/**
 * POST /api/posts/:id/like  (protected)
 */
const likePost = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { id: postId } = req.params;
    const userId = req.user.id;

    const postCheck = await client.query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Use ON CONFLICT DO NOTHING to handle duplicate likes gracefully
    const likeResult = await client.query(
      'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
      [userId, postId]
    );

    if (likeResult.rows.length > 0) {
      await client.query(
        'UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1',
        [postId]
      );
    }

    await client.query('COMMIT');

    return res.status(200).json({ success: true, data: { message: 'Post liked' } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/posts/:id/like  (protected)
 */
const unlikePost = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { id: postId } = req.params;
    const userId = req.user.id;

    const deleteResult = await client.query(
      'DELETE FROM likes WHERE user_id = $1 AND post_id = $2 RETURNING id',
      [userId, postId]
    );

    if (deleteResult.rows.length > 0) {
      await client.query(
        'UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1',
        [postId]
      );
    }

    await client.query('COMMIT');

    return res.status(200).json({ success: true, data: { message: 'Post unliked' } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

/**
 * GET /api/posts/:id/comments
 */
const getComments = async (req, res, next) => {
  try {
    const { id: postId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(
      `SELECT c.id, c.content, c.created_at,
              u.id AS user_id, u.username, u.display_name, u.avatar_url
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC
       LIMIT $2 OFFSET $3`,
      [postId, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return res.status(200).json({ success: true, data: { comments: result.rows } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/posts/:id/comments  (protected)
 * Body: { content }
 */
const addComment = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { id: postId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Comment content is required' });
    }

    const postCheck = await client.query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const commentResult = await client.query(
      'INSERT INTO comments (user_id, post_id, content) VALUES ($1, $2, $3) RETURNING *',
      [userId, postId, content.trim()]
    );

    await client.query(
      'UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1',
      [postId]
    );

    // Fetch with user info
    const fullComment = await client.query(
      `SELECT c.id, c.content, c.created_at,
              u.id AS user_id, u.username, u.display_name, u.avatar_url
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [commentResult.rows[0].id]
    );

    await client.query('COMMIT');

    return res.status(201).json({ success: true, data: { comment: fullComment.rows[0] } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/posts/:id/comments/:commentId  (protected)
 */
const deleteComment = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { id: postId, commentId } = req.params;
    const userId = req.user.id;

    const commentResult = await client.query(
      'SELECT * FROM comments WHERE id = $1 AND post_id = $2',
      [commentId, postId]
    );

    if (commentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    if (commentResult.rows[0].user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, error: 'Not authorized to delete this comment' });
    }

    await client.query('DELETE FROM comments WHERE id = $1', [commentId]);
    await client.query(
      'UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1',
      [postId]
    );

    await client.query('COMMIT');

    return res.status(200).json({ success: true, data: { message: 'Comment deleted' } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

module.exports = {
  getFeed,
  getCreatorPosts,
  createPost,
  deletePost,
  likePost,
  unlikePost,
  getComments,
  addComment,
  deleteComment,
};
