'use strict';

const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware to verify JWT access token.
 * Reads Bearer token from Authorization header, verifies it,
 * and attaches the decoded payload to req.user.
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    next(err);
  }
};

/**
 * Optional auth middleware — same as verifyToken but does NOT fail if no token
 * is present. If a token is present and valid, req.user is set. If absent or
 * invalid, req.user remains undefined and the request continues.
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    // Token invalid or expired — continue without user
    req.user = null;
    next();
  }
};

module.exports = { verifyToken, optionalAuth };
