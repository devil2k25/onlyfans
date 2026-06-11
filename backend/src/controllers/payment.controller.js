'use strict';

const { query, getClient } = require('../config/db');
require('dotenv').config();

const getStripe = () => require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/payments/subscribe/:creatorId  (protected)
 * Creates a Stripe Checkout Session for subscribing to a creator.
 */
const createSubscriptionCheckout = async (req, res, next) => {
  try {
    const { creatorId } = req.params;
    const userId = req.user.id;

    if (userId === creatorId) {
      return res.status(400).json({ success: false, error: 'You cannot subscribe to yourself' });
    }

    const creatorResult = await query(
      'SELECT id, username, display_name, subscription_price, stripe_account_id FROM users WHERE id = $1',
      [creatorId]
    );
    if (creatorResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Creator not found' });
    }

    const creator = creatorResult.rows[0];

    if (parseFloat(creator.subscription_price) === 0) {
      return res.status(400).json({ success: false, error: 'Creator has a free subscription — no checkout needed' });
    }

    const userResult = await query('SELECT id, email, stripe_customer_id FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    const stripe = getStripe();

    // Create or retrieve Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId } });
      customerId = customer.id;
      await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, userId]);
    }

    // Create a Stripe Price (one-off per session — use dynamic pricing)
    const price = await stripe.prices.create({
      unit_amount: Math.round(parseFloat(creator.subscription_price) * 100),
      currency: 'usd',
      recurring: { interval: 'month' },
      product_data: {
        name: `Subscription to ${creator.display_name || creator.username}`,
        metadata: { creatorId },
      },
    });

    const sessionParams = {
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&creatorId=${creatorId}`,
      cancel_url: `${process.env.CLIENT_URL}/creators/${creator.username}`,
      metadata: { subscriberId: userId, creatorId },
    };

    // If creator has a connected Stripe account, route payment there
    if (creator.stripe_account_id) {
      // Application fee of 20%
      sessionParams.payment_intent_data = {
        application_fee_amount: Math.round(parseFloat(creator.subscription_price) * 100 * 0.2),
        transfer_data: { destination: creator.stripe_account_id },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ success: true, data: { url: session.url, sessionId: session.id } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payments/tip/:creatorId  (protected)
 * Creates a Stripe PaymentIntent for tipping a creator.
 * Body: { amount_cents, post_id? }
 */
const createTip = async (req, res, next) => {
  try {
    const { creatorId } = req.params;
    const { amount_cents, post_id } = req.body;
    const tipperId = req.user.id;

    if (!amount_cents || parseInt(amount_cents, 10) < 100) {
      return res.status(400).json({ success: false, error: 'amount_cents must be at least 100 (i.e., $1.00)' });
    }

    if (tipperId === creatorId) {
      return res.status(400).json({ success: false, error: 'You cannot tip yourself' });
    }

    const creatorResult = await query(
      'SELECT id, stripe_account_id, display_name, username FROM users WHERE id = $1',
      [creatorId]
    );
    if (creatorResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Creator not found' });
    }

    const creator = creatorResult.rows[0];
    const stripe = getStripe();

    const userResult = await query('SELECT email, stripe_customer_id FROM users WHERE id = $1', [tipperId]);
    const user = userResult.rows[0];

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: tipperId } });
      customerId = customer.id;
      await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, tipperId]);
    }

    const intentParams = {
      amount: parseInt(amount_cents, 10),
      currency: 'usd',
      customer: customerId,
      metadata: { tipperId, creatorId, post_id: post_id || '' },
      description: `Tip for ${creator.display_name || creator.username}`,
    };

    if (creator.stripe_account_id) {
      intentParams.application_fee_amount = Math.round(parseInt(amount_cents, 10) * 0.2);
      intentParams.transfer_data = { destination: creator.stripe_account_id };
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    // Record tip in DB (pending)
    const tipResult = await query(
      `INSERT INTO tips (tipper_id, creator_id, post_id, amount_cents, stripe_payment_intent_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tipperId, creatorId, post_id || null, parseInt(amount_cents, 10), paymentIntent.id]
    );

    return res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        tip: tipResult.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/payments/history  (protected)
 * Returns the user's tip and subscription payment history.
 */
const getPaymentHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const tipsResult = await query(
      `SELECT t.id, t.amount_cents, t.created_at, t.stripe_payment_intent_id,
              u.id AS creator_id, u.username AS creator_username, u.display_name AS creator_display_name,
              u.avatar_url AS creator_avatar_url,
              p.id AS post_id, p.caption AS post_caption
       FROM tips t
       JOIN users u ON u.id = t.creator_id
       LEFT JOIN posts p ON p.id = t.post_id
       WHERE t.tipper_id = $1
       ORDER BY t.created_at DESC`,
      [userId]
    );

    const subscriptionsResult = await query(
      `SELECT s.id, s.status, s.expires_at, s.created_at, s.stripe_subscription_id,
              u.id AS creator_id, u.username AS creator_username, u.display_name AS creator_display_name,
              u.avatar_url AS creator_avatar_url, u.subscription_price
       FROM subscriptions s
       JOIN users u ON u.id = s.creator_id
       WHERE s.subscriber_id = $1
       ORDER BY s.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        tips: tipsResult.rows,
        subscriptions: subscriptionsResult.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payments/webhook
 * Handles Stripe webhook events: checkout.session.completed, customer.subscription.deleted
 */
const stripeWebhook = async (req, res, next) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ success: false, error: `Webhook Error: ${err.message}` });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.metadata) {
          const { subscriberId, creatorId } = session.metadata;
          if (subscriberId && creatorId) {
            const stripeSubId = session.subscription;

            // Retrieve subscription to get period end
            const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
            const expiresAt = new Date(stripeSub.current_period_end * 1000);

            const existing = await client.query(
              'SELECT id FROM subscriptions WHERE subscriber_id = $1 AND creator_id = $2',
              [subscriberId, creatorId]
            );

            if (existing.rows.length > 0) {
              await client.query(
                `UPDATE subscriptions
                 SET status = 'active', stripe_subscription_id = $3, expires_at = $4
                 WHERE subscriber_id = $1 AND creator_id = $2`,
                [subscriberId, creatorId, stripeSubId, expiresAt]
              );
            } else {
              await client.query(
                `INSERT INTO subscriptions (subscriber_id, creator_id, stripe_subscription_id, status, expires_at)
                 VALUES ($1, $2, $3, 'active', $4)`,
                [subscriberId, creatorId, stripeSubId, expiresAt]
              );
              await client.query(
                'UPDATE users SET total_subscribers = total_subscribers + 1 WHERE id = $1',
                [creatorId]
              );
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const stripeSubId = subscription.id;

        const result = await client.query(
          `UPDATE subscriptions SET status = 'cancelled'
           WHERE stripe_subscription_id = $1 RETURNING creator_id`,
          [stripeSubId]
        );

        if (result.rows.length > 0) {
          await client.query(
            'UPDATE users SET total_subscribers = GREATEST(total_subscribers - 1, 0) WHERE id = $1',
            [result.rows[0].creator_id]
          );
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // Renew subscription period
        const invoice = event.data.object;
        if (invoice.subscription) {
          const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription);
          const expiresAt = new Date(stripeSub.current_period_end * 1000);
          await client.query(
            `UPDATE subscriptions SET status = 'active', expires_at = $2
             WHERE stripe_subscription_id = $1`,
            [invoice.subscription, expiresAt]
          );
        }
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }

    await client.query('COMMIT');
    return res.status(200).json({ received: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Webhook handler error:', err);
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  } finally {
    client.release();
  }
};

/**
 * GET /api/payments/onboard  (protected)
 * Creates a Stripe Connect account link for a creator to onboard.
 */
const onboardCreator = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const stripe = getStripe();

    const userResult = await query(
      'SELECT id, email, stripe_account_id, is_creator FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (!user.is_creator) {
      return res.status(403).json({ success: false, error: 'Only creators can onboard with Stripe' });
    }

    let accountId = user.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        metadata: { userId },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      await query('UPDATE users SET stripe_account_id = $1 WHERE id = $2', [accountId, userId]);
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.CLIENT_URL}/settings/payments?onboard=refresh`,
      return_url: `${process.env.CLIENT_URL}/settings/payments?onboard=complete`,
      type: 'account_onboarding',
    });

    return res.status(200).json({ success: true, data: { url: accountLink.url } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createSubscriptionCheckout,
  createTip,
  getPaymentHistory,
  stripeWebhook,
  onboardCreator,
};
