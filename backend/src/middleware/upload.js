'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const USE_S3 = !!process.env.AWS_S3_BUCKET;
const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';

let s3Client, multerS3;

if (USE_S3) {
  const { S3Client } = require('@aws-sdk/client-s3');
  multerS3 = require('multer-s3');
  // Credentials come from EC2 IAM role automatically; no hard-coded keys needed.
  s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
}

// ── Local directory setup ─────────────────────────────────────────
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

if (!USE_S3) {
  ['', 'media', 'avatars', 'covers'].forEach((sub) =>
    ensureDir(path.join(process.cwd(), UPLOADS_DIR, sub))
  );
}

// ── Allowed MIME types ────────────────────────────────────────────
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALL_MEDIA_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const makeFileFilter = (allowedTypes) => (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) return cb(null, true);
  cb(
    new multer.MulterError(
      'LIMIT_UNEXPECTED_FILE',
      `Unsupported type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`
    ),
    false
  );
};

// ── Storage engine ────────────────────────────────────────────────
const makeStorage = (subfolder) => {
  if (USE_S3) {
    return multerS3({
      s3: s3Client,
      bucket: process.env.AWS_S3_BUCKET,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${subfolder}/${uuidv4()}${ext}`);
      },
    });
  }

  return multer.diskStorage({
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
};

/**
 * Returns the public URL for an uploaded file.
 * - S3: uses file.location (full https://bucket.s3.region.amazonaws.com/key)
 * - Local disk: constructs a relative /uploads/... path
 */
const getFileUrl = (file) => {
  if (file.location) return file.location;
  const normalized = file.path.replace(/\\/g, '/');
  const idx = normalized.indexOf(UPLOADS_DIR);
  return '/' + normalized.slice(idx);
};

const uploadMedia = multer({
  storage: makeStorage('media'),
  fileFilter: makeFileFilter(ALL_MEDIA_TYPES),
  limits: { fileSize: MAX_FILE_SIZE },
}).array('media', 10);

const uploadAvatar = multer({
  storage: makeStorage('avatars'),
  fileFilter: makeFileFilter(IMAGE_TYPES),
  limits: { fileSize: MAX_FILE_SIZE },
}).single('avatar');

const uploadCover = multer({
  storage: makeStorage('covers'),
  fileFilter: makeFileFilter(IMAGE_TYPES),
  limits: { fileSize: MAX_FILE_SIZE },
}).single('cover');

module.exports = { uploadMedia, uploadAvatar, uploadCover, getFileUrl };
