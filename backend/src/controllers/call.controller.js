'use strict';

const { query, getClient } = require('../config/db');
require('dotenv').config();

const getStripe = () => require('stripe')(process.env.STRIPE_SECRET_KEY);

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Given a call_type ('video' | 'audio') and a creator row,
 * return the per-minute rate in cents.
 */
function rateForType(callType, creator) {
  return callType === 'video'
    ? (creator.video_call_rate_cents || 500)
    : (creator.audio_call_rate_cents || 300);
}

// ─── Call Sessions ────────────────────────────────────────────────────────────

/**
 * POST /api/calls
 * Body: { receiver_id, call_type }
 * Creates a new pending call_session.
 */
const createSession = async (req, res, next) => {
  try {
    const callerId = req.user.id;
    const { receiver_id, call_type } = req.body;

    if (!receiver_id || !call_type) {
      return res.status(400).json({ success: false, error: 'receiver_id and call_type are required' });
    }
    if (!['video', 'audio'].includes(call_type)) {
      return res.status(400).json({ success: false, error: 'call_type must be "video" or "audio"' });
    }
    if (callerId === receiver_id) {
      return res.status(400).json({ success: false, error: 'Cannot call yourself' });
    }

    const receiverResult = await query('SELECT id FROM users WHERE id = $1', [receiver_id]);
    if (receiverResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Receiver not found' });
    }

    const result = await query(
      `INSERT INTO call_sessions (caller_id, receiver_id, call_type)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [callerId, receiver_id, call_type]
    );

    return res.status(201).json({ success: true, data: { session: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/calls
 * Returns paginated call history for the authenticated user.
 */
const getSessions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const result = await query(
      `SELECT
         cs.*,
         caller.id         AS caller_id,
         caller.username   AS caller_username,
         caller.display_name AS caller_display_name,
         caller.avatar_url AS caller_avatar_url,
         recv.id           AS receiver_id,
         recv.username     AS receiver_username,
         recv.display_name AS receiver_display_name,
         recv.avatar_url   AS receiver_avatar_url
       FROM call_sessions cs
       JOIN users caller ON caller.id = cs.caller_id
       JOIN users recv   ON recv.id   = cs.receiver_id
       WHERE cs.caller_id = $1 OR cs.receiver_id = $1
       ORDER BY cs.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return res.status(200).json({
      success: true,
      data: {
        sessions: result.rows,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/calls/:id
 * Returns a single call session by ID.
 */
const getSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT
         cs.*,
         caller.username   AS caller_username,
         caller.display_name AS caller_display_name,
         caller.avatar_url AS caller_avatar_url,
         recv.username     AS receiver_username,
         recv.display_name AS receiver_display_name,
         recv.avatar_url   AS receiver_avatar_url
       FROM call_sessions cs
       JOIN users caller ON caller.id = cs.caller_id
       JOIN users recv   ON recv.id   = cs.receiver_id
       WHERE cs.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Call session not found' });
    }

    const session = result.rows[0];

    // Only participants can view the session
    if (session.caller_id !== userId && session.receiver_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    return res.status(200).json({ success: true, data: { session } });
  } catch (err) {
    next(err);
  }
};

// ─── Bookings ─────────────────────────────────────────────────────────────────

/**
 * GET /api/calls/bookings
 * Returns bookings for the authenticated user (as creator or subscriber).
 */
const getBookings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, status } = req.query;

    let whereClause = '(cb.creator_id = $1 OR cb.subscriber_id = $1)';
    const params = [userId, parseInt(limit, 10), parseInt(offset, 10)];

    if (status) {
      whereClause += ` AND cb.status = $${params.length + 1}`;
      params.push(status);
    }

    const result = await query(
      `SELECT
         cb.*,
         creator.username     AS creator_username,
         creator.display_name AS creator_display_name,
         creator.avatar_url   AS creator_avatar_url,
         sub.username         AS subscriber_username,
         sub.display_name     AS subscriber_display_name,
         sub.avatar_url       AS subscriber_avatar_url
       FROM call_bookings cb
       JOIN users creator ON creator.id = cb.creator_id
       JOIN users sub     ON sub.id     = cb.subscriber_id
       WHERE ${whereClause}
       ORDER BY cb.scheduled_at ASC
       LIMIT $2 OFFSET $3`,
      params
    );

    return res.status(200).json({
      success: true,
      data: {
        bookings: result.rows,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/calls/bookings
 * Body: { creator_id, scheduled_at, duration_minutes, call_type, notes? }
 * Creates a booking after checking availability and creating a Stripe PaymentIntent.
 */
const createBooking = async (req, res, next) => {
  try {
    const subscriberId = req.user.id;
    const { creator_id, scheduled_at, duration_minutes = 15, call_type, notes } = req.body;

    if (!creator_id || !scheduled_at || !call_type) {
      return res.status(400).json({
        success: false,
        error: 'creator_id, scheduled_at, and call_type are required',
      });
    }
    if (!['video', 'audio'].includes(call_type)) {
      return res.status(400).json({ success: false, error: 'call_type must be "video" or "audio"' });
    }
    if (subscriberId === creator_id) {
      return res.status(400).json({ success: false, error: 'Cannot book a call with yourself' });
    }

    const mins = parseInt(duration_minutes, 10);
    if (isNaN(mins) || mins < 5) {
      return res.status(400).json({ success: false, error: 'duration_minutes must be at least 5' });
    }

    // Fetch creator rates
    const creatorResult = await query(
      `SELECT id, username, display_name, stripe_account_id,
              video_call_rate_cents, audio_call_rate_cents, is_creator
       FROM users WHERE id = $1`,
      [creator_id]
    );
    if (creatorResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Creator not found' });
    }
    const creator = creatorResult.rows[0];

    // Check that the requested slot falls within an active availability window
    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid scheduled_at date' });
    }

    // day_of_week: 0=Sunday … 6=Saturday (JS convention)
    const dayOfWeek = scheduledDate.getUTCDay();
    const timeStr = scheduledDate.toISOString().slice(11, 19); // "HH:MM:SS"

    const slotResult = await query(
      `SELECT id FROM availability_slots
       WHERE creator_id = $1
         AND day_of_week = $2
         AND start_time <= $3::TIME
         AND end_time   >= ($3::TIME + ($4 || ' minutes')::INTERVAL)
         AND is_active = TRUE
       LIMIT 1`,
      [creator_id, dayOfWeek, timeStr, mins]
    );

    if (slotResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'The requested time slot is not within the creator\'s availability',
      });
    }

    // Compute price: rate_per_minute × duration_minutes
    const ratePerMinCents = rateForType(call_type, creator);
    const priceCents = Math.round((ratePerMinCents / 60) * mins * 60); // rate is already per-minute equivalent: simplify
    // Actually rate is stored as per-minute cents; compute total:
    const totalCents = ratePerMinCents * mins;

    // Create Stripe PaymentIntent
    const stripe = getStripe();
    const userResult = await query(
      'SELECT email, stripe_customer_id FROM users WHERE id = $1',
      [subscriberId]
    );
    const user = userResult.rows[0];

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: subscriberId },
      });
      customerId = customer.id;
      await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, subscriberId]);
    }

    const intentParams = {
      amount: totalCents,
      currency: 'usd',
      customer: customerId,
      metadata: {
        type: 'call_booking',
        subscriberId,
        creatorId: creator_id,
        callType: call_type,
        durationMinutes: String(mins),
      },
      description: `${call_type} call booking with ${creator.display_name || creator.username}`,
    };

    if (creator.stripe_account_id) {
      intentParams.application_fee_amount = Math.round(totalCents * 0.2);
      intentParams.transfer_data = { destination: creator.stripe_account_id };
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    // Save booking
    const bookingResult = await query(
      `INSERT INTO call_bookings
         (creator_id, subscriber_id, scheduled_at, duration_minutes, call_type, price_cents, notes, stripe_payment_intent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        creator_id,
        subscriberId,
        scheduledDate.toISOString(),
        mins,
        call_type,
        totalCents,
        notes || null,
        paymentIntent.id,
      ]
    );

    return res.status(201).json({
      success: true,
      data: {
        booking: bookingResult.rows[0],
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/calls/bookings/:id/confirm
 * Creator confirms a pending booking.
 */
const confirmBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const bookingResult = await query('SELECT * FROM call_bookings WHERE id = $1', [id]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    if (booking.creator_id !== userId) {
      return res.status(403).json({ success: false, error: 'Only the creator can confirm this booking' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Booking is already ${booking.status}` });
    }

    const updated = await query(
      `UPDATE call_bookings SET status = 'confirmed' WHERE id = $1 RETURNING *`,
      [id]
    );

    return res.status(200).json({ success: true, data: { booking: updated.rows[0] } });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/calls/bookings/:id/cancel
 * Creator or subscriber cancels a booking.
 */
const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const bookingResult = await query('SELECT * FROM call_bookings WHERE id = $1', [id]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    if (booking.creator_id !== userId && booking.subscriber_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (['cancelled', 'completed'].includes(booking.status)) {
      return res.status(400).json({ success: false, error: `Booking is already ${booking.status}` });
    }

    const updated = await query(
      `UPDATE call_bookings SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [id]
    );

    return res.status(200).json({ success: true, data: { booking: updated.rows[0] } });
  } catch (err) {
    next(err);
  }
};

// ─── Availability ─────────────────────────────────────────────────────────────

/**
 * GET /api/calls/availability/:creatorId
 * Returns all active availability slots for a creator.
 */
const getAvailability = async (req, res, next) => {
  try {
    const { creatorId } = req.params;

    const result = await query(
      `SELECT id, day_of_week, start_time, end_time, is_active, created_at
       FROM availability_slots
       WHERE creator_id = $1
       ORDER BY day_of_week, start_time`,
      [creatorId]
    );

    return res.status(200).json({ success: true, data: { slots: result.rows } });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/calls/availability
 * Body: { slots: [{ day_of_week, start_time, end_time }] }
 * Replaces all availability slots for the authenticated creator.
 */
const setAvailability = async (req, res, next) => {
  const client = await getClient();
  try {
    const creatorId = req.user.id;
    const { slots } = req.body;

    if (!Array.isArray(slots)) {
      return res.status(400).json({ success: false, error: 'slots must be an array' });
    }

    // Validate each slot
    for (const slot of slots) {
      const dow = parseInt(slot.day_of_week, 10);
      if (isNaN(dow) || dow < 0 || dow > 6) {
        return res.status(400).json({ success: false, error: 'day_of_week must be 0–6' });
      }
      if (!slot.start_time || !slot.end_time) {
        return res.status(400).json({ success: false, error: 'start_time and end_time are required for each slot' });
      }
    }

    await client.query('BEGIN');

    // Delete existing slots for this creator
    await client.query('DELETE FROM availability_slots WHERE creator_id = $1', [creatorId]);

    // Insert new slots
    const inserted = [];
    for (const slot of slots) {
      const r = await client.query(
        `INSERT INTO availability_slots (creator_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [creatorId, parseInt(slot.day_of_week, 10), slot.start_time, slot.end_time]
      );
      inserted.push(r.rows[0]);
    }

    await client.query('COMMIT');

    return res.status(200).json({ success: true, data: { slots: inserted } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

module.exports = {
  createSession,
  getSessions,
  getSession,
  getBookings,
  createBooking,
  confirmBooking,
  cancelBooking,
  getAvailability,
  setAvailability,
};
