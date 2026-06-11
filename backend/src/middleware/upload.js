'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';

// Ensure uploads directory and subdirectories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir(path.join(process.cwd(), UPLOADS_DIR));
ensureDir(path.join(process.cwd(), UPLOADS_DIR, 'media'));
ensureDir(path.join(process.cwd(), UPLOADS_DIR, 'avatars'));
ensureDir(path.join(process.cwd(), UPLOADS_DIR, 'covers'));

// Allowed MIME types
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALL_MEDIA_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

// Storage engine factory
const makeStorage = (subfolder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const dest = path.join(process.cwd(), UPLOADS_DIR, subfolder);
      ensureDir(dest);
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });

// File filter factory
const makeFileFilter = (allowedTypes) => (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        'LIMIT_UNEXPECTED_FILE',
        `Unsupported file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`
      ),
      false
    );
  }
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Upload middleware for post media (images + videos).
 * Field name: "media", up to 10 files, max 100 MB each.
 */
const uploadMedia = multer({
  storage: makeStorage('media'),
  fileFilter: makeFileFilter(ALL_MEDIA_TYPES),
  limits: { fileSize: MAX_FILE_SIZE },
}).array('media', 10);

/**
 * Upload middleware for user avatar.
 * Field name: "avatar", single image file, max 100 MB.
 */
const uploadAvatar = multer({
  storage: makeStorage('avatars'),
  fileFilter: makeFileFilter(IMAGE_TYPES),
  limits: { fileSize: MAX_FILE_SIZE },
}).single('avatar');

/**
 * Upload middleware for user cover image.
 * Field name: "cover", single image file, max 100 MB.
 */
const uploadCover = multer({
  storage: makeStorage('covers'),
  fileFilter: makeFileFilter(IMAGE_TYPES),
  limits: { fileSize: MAX_FILE_SIZE },
}).single('cover');

module.exports = { uploadMedia, uploadAvatar, uploadCover };
