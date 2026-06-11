'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
require('dotenv').config();

/** @type {import('socket.io').Server|null} */
let io = null;

/**
 * Initialise Socket.io on the given HTTP server.
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // ── Authentication middleware ──────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id || decoded.userId || decoded.sub;
      if (!socket.userId) {
        return next(new Error('Invalid token payload'));
      }
      next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Each user joins their own private room for targeted events
    socket.join(`user:${userId}`);

    console.log(`[Socket] User ${userId} connected (${socket.id})`);

    // ──────────────────────────────────────────────────────────────────────
    // 1-on-1 CALL SIGNALING
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Caller notifies a target user that an incoming call is arriving.
     * Payload: { targetUserId, callType, sessionId }
     */
    socket.on('call:initiate', ({ targetUserId, callType, sessionId }) => {
      io.to(`user:${targetUserId}`).emit('call:incoming', {
        callerId: userId,
        callType,
        sessionId,
      });
    });

    /**
     * Callee accepts the call.
     * Payload: { sessionId, callerId }
     */
    socket.on('call:accept', async ({ sessionId, callerId }) => {
      try {
        await query(
          `UPDATE call_sessions
           SET status = 'active', started_at = NOW()
           WHERE id = $1`,
          [sessionId]
        );
        io.to(`user:${callerId}`).emit('call:accepted', { sessionId, acceptedBy: userId });
      } catch (err) {
        console.error('[Socket] call:accept DB error:', err.message);
      }
    });

    /**
     * Callee rejects the call.
     * Payload: { sessionId, callerId }
     */
    socket.on('call:reject', async ({ sessionId, callerId }) => {
      try {
        await query(
          `UPDATE call_sessions SET status = 'rejected' WHERE id = $1`,
          [sessionId]
        );
        io.to(`user:${callerId}`).emit('call:rejected', { sessionId, rejectedBy: userId });
      } catch (err) {
        console.error('[Socket] call:reject DB error:', err.message);
      }
    });

    /**
     * Forward WebRTC offer to target.
     * Payload: { targetUserId, offer, sessionId }
     */
    socket.on('call:offer', ({ targetUserId, offer, sessionId }) => {
      io.to(`user:${targetUserId}`).emit('call:offer', { offer, sessionId, fromUserId: userId });
    });

    /**
     * Forward WebRTC answer to target.
     * Payload: { targetUserId, answer, sessionId }
     */
    socket.on('call:answer', ({ targetUserId, answer, sessionId }) => {
      io.to(`user:${targetUserId}`).emit('call:answer', { answer, sessionId, fromUserId: userId });
    });

    /**
     * Forward ICE candidate to target.
     * Payload: { targetUserId, candidate }
     */
    socket.on('call:ice-candidate', ({ targetUserId, candidate }) => {
      io.to(`user:${targetUserId}`).emit('call:ice-candidate', { candidate, fromUserId: userId });
    });

    /**
     * End the call and update DB.
     * Payload: { sessionId, targetUserId, durationSeconds }
     */
    socket.on('call:end', async ({ sessionId, targetUserId, durationSeconds }) => {
      try {
        await query(
          `UPDATE call_sessions
           SET status = 'ended', ended_at = NOW(), duration_seconds = $2
           WHERE id = $1`,
          [sessionId, durationSeconds || null]
        );
        io.to(`user:${targetUserId}`).emit('call:ended', {
          sessionId,
          endedBy: userId,
          durationSeconds,
        });
      } catch (err) {
        console.error('[Socket] call:end DB error:', err.message);
      }
    });

    // ──────────────────────────────────────────────────────────────────────
    // LIVE STREAM SIGNALING
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Creator goes live.
     * Payload: { streamId }
     */
    socket.on('stream:go-live', async ({ streamId }) => {
      try {
        socket.join(`stream:${streamId}:broadcaster`);
        socket.join(`stream:${streamId}`);

        await query(
          `UPDATE live_streams SET status = 'live', started_at = NOW() WHERE id = $1`,
          [streamId]
        );

        io.to(`stream:${streamId}`).emit('stream:started', { streamId, broadcasterId: userId });
      } catch (err) {
        console.error('[Socket] stream:go-live DB error:', err.message);
      }
    });

    /**
     * Viewer joins a stream room.
     * Payload: { streamId }
     */
    socket.on('stream:viewer-join', async ({ streamId }) => {
      try {
        socket.join(`stream:${streamId}`);

        await query(
          `UPDATE live_streams
           SET viewer_count = viewer_count + 1,
               peak_viewer_count = GREATEST(peak_viewer_count, viewer_count + 1)
           WHERE id = $1`,
          [streamId]
        );

        // Notify the broadcaster a new viewer arrived
        io.to(`stream:${streamId}:broadcaster`).emit('stream:new-viewer', {
          viewerId: userId,
          viewerSocketId: socket.id,
        });
      } catch (err) {
        console.error('[Socket] stream:viewer-join DB error:', err.message);
      }
    });

    /**
     * Broadcaster sends WebRTC offer to a specific viewer socket.
     * Payload: { viewerSocketId, offer, streamId }
     */
    socket.on('stream:offer-viewer', ({ viewerSocketId, offer, streamId }) => {
      io.to(viewerSocketId).emit('stream:offer', {
        offer,
        streamId,
        broadcasterSocketId: socket.id,
      });
    });

    /**
     * Viewer sends WebRTC answer back to the broadcaster socket.
     * Payload: { broadcasterSocketId, answer }
     */
    socket.on('stream:answer', ({ broadcasterSocketId, answer }) => {
      io.to(broadcasterSocketId).emit('stream:answer', {
        answer,
        viewerSocketId: socket.id,
      });
    });

    /**
     * Forward ICE candidate to a specific socket (viewer ↔ broadcaster).
     * Payload: { targetSocketId, candidate }
     */
    socket.on('stream:ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('stream:ice-candidate', {
        candidate,
        fromSocketId: socket.id,
      });
    });

    /**
     * Viewer or creator sends a chat message.
     * Payload: { streamId, content }
     */
    socket.on('stream:chat', async ({ streamId, content }) => {
      try {
        if (!content || !content.trim()) return;

        // Fetch sender info
        const userResult = await query(
          'SELECT username, display_name FROM users WHERE id = $1',
          [userId]
        );
        if (userResult.rows.length === 0) return;

        const { username, display_name: displayName } = userResult.rows[0];

        // Persist to DB
        await query(
          `INSERT INTO stream_chat (stream_id, user_id, content) VALUES ($1, $2, $3)`,
          [streamId, userId, content.trim()]
        );

        // Broadcast to all room members
        io.to(`stream:${streamId}`).emit('stream:chat-message', {
          userId,
          username,
          displayName,
          content: content.trim(),
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[Socket] stream:chat DB error:', err.message);
      }
    });

    /**
     * Creator ends the stream.
     * Payload: { streamId }
     */
    socket.on('stream:end', async ({ streamId }) => {
      try {
        await query(
          `UPDATE live_streams SET status = 'ended', ended_at = NOW() WHERE id = $1`,
          [streamId]
        );
        io.to(`stream:${streamId}`).emit('stream:ended', { streamId, endedBy: userId });
      } catch (err) {
        console.error('[Socket] stream:end DB error:', err.message);
      }
    });

    /**
     * Viewer leaves a stream room.
     * Payload: { streamId }
     */
    socket.on('stream:viewer-leave', async ({ streamId }) => {
      try {
        socket.leave(`stream:${streamId}`);
        await query(
          `UPDATE live_streams
           SET viewer_count = GREATEST(viewer_count - 1, 0)
           WHERE id = $1`,
          [streamId]
        );
      } catch (err) {
        console.error('[Socket] stream:viewer-leave DB error:', err.message);
      }
    });

    // ── Disconnect cleanup ─────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[Socket] User ${userId} disconnected (${socket.id})`);

      try {
        // Decrement viewer_count for every stream room this socket was in
        const rooms = Array.from(socket.rooms);
        const streamRooms = rooms.filter(
          (r) => r.startsWith('stream:') && !r.endsWith(':broadcaster')
        );

        for (const room of streamRooms) {
          // room format: "stream:<uuid>"
          const parts = room.split(':');
          if (parts.length === 2) {
            const streamId = parts[1];
            await query(
              `UPDATE live_streams
               SET viewer_count = GREATEST(viewer_count - 1, 0)
               WHERE id = $1 AND status = 'live'`,
              [streamId]
            );
          }
        }
      } catch (err) {
        console.error('[Socket] disconnect cleanup error:', err.message);
      }
    });
  });

  return io;
}

/**
 * Returns the Socket.io server instance (after initSocket has been called).
 * @returns {import('socket.io').Server}
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialised. Call initSocket(httpServer) first.');
  }
  return io;
}

module.exports = { initSocket, getIO };
