'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
require('dotenv').config();

const SALT_ROUNDS = 12;

/**
 * Generate an access token (7d expiry) and refresh token (30d expiry)
 * @param {object} payload - { id, email, username, is_creator }
 * @returns {{ accessToken: string, refreshToken: string }}
 */
const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

/**
 * Strip sensitive fields from a user row before sending to client.
 */
const sanitizeUser = (user) => {
  const { password_hash, stripe_account_id, stripe_customer_id, ...safe } = user;
  return safe;
};

/**
 * POST /api/auth/register
 * Body: { email, username, password, display_name? }
 */
const register = async (req, res, next) => {
  try {
    const { email, username, password, display_name } = req.body;

    // Validation
    if (!email || !username || !password) {
      return res.status(400).json({ success: false, error: 'email, username, and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ success: false, error: 'Username must be 3-50 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ success: false, error: 'Username may only contain letters, numbers, and underscores' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    // Check uniqueness
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email or username already in use' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await query(
      `INSERT INTO users (email, username, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [email.toLowerCase(), username.toLowerCase(), password_hash, display_name || username]
    );

    const user = result.rows[0];
    const tokenPayload = { id: user.id, email: user.email, username: user.username, is_creator: user.is_creator };
    const { accessToken, refreshToken } = generateTokens(tokenPayload);

    return res.status(201).json({
      success: true,
      data: {
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password are required' });
    }

    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const tokenPayload = { id: user.id, email: user.email, username: user.username, is_creator: user.is_creator };
    const { accessToken, refreshToken } = generateTokens(tokenPayload);

    return res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me  (protected)
 * Returns the current user from DB using req.user.id
 */
const getMe = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({ success: true, data: { user: sanitizeUser(result.rows[0]) } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 * Verifies the refresh token and issues a new access token.
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'refreshToken is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }

    // Ensure user still exists
    const result = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User no longer exists' });
    }

    const user = result.rows[0];
    const tokenPayload = { id: user.id, email: user.email, username: user.username, is_creator: user.is_creator };
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(tokenPayload);

    return res.status(200).json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, refreshToken };
