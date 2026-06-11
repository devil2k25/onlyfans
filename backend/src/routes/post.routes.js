'use strict';

const express = require('express');
const router = express.Router();
const {
  getFeed,
  getCreatorPosts,
  createPost,
  deletePost,
  likePost,
  unlikePost,
  getComments,
  addComment,
  deleteComment,
} = require('../controllers/post.controller');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { uploadMedia } = require('../middleware/upload');

// GET /api/posts/feed  (protected)
router.get('/feed', verifyToken, getFeed);

// GET /api/posts/creator/:userId  (optional auth)
router.get('/creator/:userId', optionalAuth, getCreatorPosts);

// POST /api/posts  (protected + media upload)
router.post('/', verifyToken, uploadMedia, createPost);

// DELETE /api/posts/:id  (protected)
router.delete('/:id', verifyToken, deletePost);

// POST /api/posts/:id/like  (protected)
router.post('/:id/like', verifyToken, likePost);

// DELETE /api/posts/:id/like  (protected)
router.delete('/:id/like', verifyToken, unlikePost);

// GET /api/posts/:id/comments
router.get('/:id/comments', getComments);

// POST /api/posts/:id/comments  (protected)
router.post('/:id/comments', verifyToken, addComment);

// DELETE /api/posts/:id/comments/:commentId  (protected)
router.delete('/:id/comments/:commentId', verifyToken, deleteComment);

module.exports = router;
