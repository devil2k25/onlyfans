'use strict';

const { query, getClient } = require('../config/db');
require('dotenv').config();

/**
 * GET /api/subscriptions/my  (protected)
 * Returns subscriptions where subscriber_id = req.user.id, with creator info.
 */
const getMySubscriptions = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT s.id, s.status, s.expires_at, s.created_at, s.stripe_subscription_id,
              u.id AS creator_id, u.username, u.display_name, u.avatar_url,
              u.cover_url, u.bio, u.subscription_price, u.total_posts
       FROM subscriptions s
       JOIN users u ON u.id = s.creator_id
       WHERE s.subscriber_id = $1
         AND s.status IN ('active','free')
         AND (s.expires_at IS NULL OR s.expires_at > NOW())
       ORDER BY s.created_at DESC`,
      [userId]
    );

    return res.status(200).json({ success: true, data: { subscriptions: result.rows } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/subscriptions/subscribers  (protected, creator only)
 * Returns subscriptions where creator_id = req.user.id.
 */
const getMySubscribers = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT s.id, s.status, s.expires_at, s.created_at,
              u.id AS subscriber_id, u.username, u.display_name, u.avatar_url
       FROM subscriptions s
       JOIN users u ON u.id = s.subscriber_id
       WHERE s.creator_id = $1
         AND s.status IN ('active','free')
         AND (s.expires_at IS NULL OR s.expires_at > NOW())
       ORDER BY s.created_at DESC`,
      [userId]
    );

    return res.status(200).json({ success: true, data: { subscribers: result.rows } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/subscriptions/:creatorId  (protected)
 * Subscribe to a creator. For free creators (subscription_price = 0), inserts directly.
 * For paid creators, checks for active Stripe subscription.
 */
const subscribe = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { creatorId } = req.params;
    const subscriberId = req.user.id;

    if (subscriberId === creatorId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'You cannot subscribe to yourself' });
    }

    // Get creator info
    const creatorResult = await client.query(
      'SELECT id, subscription_price, stripe_account_id FROM users WHERE id = $1',
      [creatorId]
    );
    if (creatorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Creator not found' });
    }

    const creator = creatorResult.rows[0];

    // Check for existing subscription
    const existingResult = await client.query(
      'SELECT id, status FROM subscriptions WHERE subscriber_id = $1 AND creator_id = $2',
      [subscriberId, creatorId]
    );

    if (existingResult.rows.length > 0 && ['active', 'free'].includes(existingResult.rows[0].status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Already subscribed to this creator' });
    }

    const isFree = parseFloat(creator.subscription_price) === 0;

    if (isFree) {
      // Direct free subscription
      let subResult;
      if (existingResult.rows.length > 0) {
        subResult = await client.query(
          `UPDATE subscriptions SET status = 'free', expires_at = NULL, updated_at = NOW()
           WHERE subscriber_id = $1 AND creator_id = $2 RETURNING *`,
          [subscriberId, creatorId]
        );
      } else {
        subResult = await client.query(
          `INSERT INTO subscriptions (subscriber_id, creator_id, status, expires_at)
           VALUES ($1, $2, 'free', NULL) RETURNING *`,
          [subscriberId, creatorId]
        );
        // Increment subscriber count
        await client.query(
          'UPDATE users SET total_subscribers = total_subscribers + 1 WHERE id = $1',
          [creatorId]
        );
      }

      await client.query('COMMIT');
      return res.status(201).json({ success: true, data: { subscription: subResult.rows[0] } });
    }

    // Paid creator — check for Stripe subscription ID in request body
    const { stripe_subscription_id } = req.body;
    if (!stripe_subscription_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'stripe_subscription_id is required for paid creators. Complete Stripe checkout first.',
      });
    }

    // Verify with Stripe that the subscription is active
    const Stripe = require('stripe');
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    let stripeSub;
    try {
      stripeSub = await stripe.subscriptions.retrieve(stripe_subscription_id);
    } catch (stripeErr) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Invalid Stripe subscription ID' });
    }

    if (stripeSub.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Stripe subscription is not active' });
    }

    const expiresAt = new Date(stripeSub.current_period_end * 1000);

    let subResult;
    if (existingResult.rows.length > 0) {
      subResult = await client.query(
        `UPDATE subscriptions
         SET status = 'active', stripe_subscription_id = $3, expires_at = $4
         WHERE subscriber_id = $1 AND creator_id = $2 RETURNING *`,
        [subscriberId, creatorId, stripe_subscription_id, expiresAt]
      );
    } else {
      subResult = await client.query(
        `INSERT INTO subscriptions (subscriber_id, creator_id, stripe_subscription_id, status, expires_at)
         VALUES ($1, $2, $3, 'active', $4) RETURNING *`,
        [subscriberId, creatorId, stripe_subscription_id, expiresAt]
      );
      await client.query(
        'UPDATE users SET total_subscribers = total_subscribers + 1 WHERE id = $1',
        [creatorId]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({ success: true, data: { subscription: subResult.rows[0] } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/subscriptions/:creatorId  (protected)
 */
const unsubscribe = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { creatorId } = req.params;
    const subscriberId = req.user.id;

    const deleteResult = await client.query(
      `DELETE FROM subscriptions WHERE subscriber_id = $1 AND creator_id = $2 RETURNING id`,
      [subscriberId, creatorId]
    );

    if (deleteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    await client.query(
      'UPDATE users SET total_subscribers = GREATEST(total_subscribers - 1, 0) WHERE id = $1',
      [creatorId]
    );

    await client.query('COMMIT');

    return res.status(200).json({ success: true, data: { message: 'Unsubscribed successfully' } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

/**
 * GET /api/subscriptions/check/:creatorId  (protected)
 * Returns whether req.user is subscribed to the given creator.
 */
const checkSubscription = async (req, res, next) => {
  try {
    const { creatorId } = req.params;
    const subscriberId = req.user.id;

    const result = await query(
      `SELECT id, status, expires_at FROM subscriptions
       WHERE subscriber_id = $1 AND creator_id = $2
         AND status IN ('active','free')
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [subscriberId, creatorId]
    );

    const isSubscribed = result.rows.length > 0;

    return res.status(200).json({
      success: true,
      data: {
        isSubscribed,
        subscription: isSubscribed ? result.rows[0] : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/subscriptions/free/:creatorId  (protected)
 * Directly subscribe without payment — only valid when creator price is 0.
 */
const freeSubscribe = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { creatorId } = req.params;
    const subscriberId = req.user.id;

    if (subscriberId === creatorId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'You cannot subscribe to yourself' });
    }

    const creatorResult = await client.query(
      'SELECT id, subscription_price FROM users WHERE id = $1',
      [creatorId]
    );

    if (creatorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Creator not found' });
    }

    if (parseFloat(creatorResult.rows[0].subscription_price) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'This creator requires payment to subscribe' });
    }

    const existingResult = await client.query(
      'SELECT id, status FROM subscriptions WHERE subscriber_id = $1 AND creator_id = $2',
      [subscriberId, creatorId]
    );

    if (existingResult.rows.length > 0 && ['active', 'free'].includes(existingResult.rows[0].status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Already subscribed to this creator' });
    }

    let subResult;
    if (existingResult.rows.length > 0) {
      subResult = await client.query(
        `UPDATE subscriptions SET status = 'free', expires_at = NULL
         WHERE subscriber_id = $1 AND creator_id = $2 RETURNING *`,
        [subscriberId, creatorId]
      );
    } else {
      subResult = await client.query(
        `INSERT INTO subscriptions (subscriber_id, creator_id, status, expires_at)
         VALUES ($1, $2, 'free', NULL) RETURNING *`,
        [subscriberId, creatorId]
      );
      await client.query(
        'UPDATE users SET total_subscribers = total_subscribers + 1 WHERE id = $1',
        [creatorId]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({ success: true, data: { subscription: subResult.rows[0] } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

module.exports = {
  getMySubscriptions,
  getMySubscribers,
  subscribe,
  unsubscribe,
  checkSubscription,
  freeSubscribe,
};
