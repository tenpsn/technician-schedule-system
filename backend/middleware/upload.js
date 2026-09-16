const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const logger = require('../config/logger');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = (parseInt(process.env.MAX_PHOTO_SIZE_MB, 10) || 10) * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 20;
const MAX_PHOTO_WIDTH = 1600;
const JPEG_QUALITY = 75;

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('รองรับเฉพาะไฟล์รูปภาพ (jpg, png, webp)'));
  }
  cb(null, true);
};

// Buffer in memory instead of writing the raw upload straight to disk — the
// route re-encodes each buffer through sharp (resize + compress) before
// anything touches the filesystem, so the MAX_PHOTO_SIZE_MB limit only caps
// what a phone camera can send in, not what ends up stored. MAX_FILES_PER_UPLOAD
// caps how many buffers can sit in memory at once per request — memoryStorage
// has no file-count limit of its own, so a huge attachment count is an easy
// way to spike RAM without it.
const photosUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES_PER_UPLOAD }
}).array('photos', MAX_FILES_PER_UPLOAD);

// Wrap multer so its errors (file too large, wrong type) come back as 400s
// instead of falling through to the generic 500 handler.
const uploadPhotos = (req, res, next) => {
  photosUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Resizes to a max width and re-encodes as JPEG so uploads from phone cameras
// (often several MB) end up a fraction of the size on disk. Always outputs
// .jpg regardless of the source format — job-site photos don't need PNG/WebP
// transparency, and a single format keeps compression predictable.
const saveCompressedPhoto = async (orderId, buffer) => {
  const dir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', 'work-orders', orderId);
  await fsp.mkdir(dir, { recursive: true });

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
  const filePath = path.join(dir, filename);

  await sharp(buffer)
    .rotate() // apply EXIF orientation before it gets stripped by re-encoding
    .resize({ width: MAX_PHOTO_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(filePath);

  return `/uploads/work-orders/${orderId}/${filename}`;
};

// photoUrl looks like "/uploads/work-orders/<id>/<filename>" (see saveCompressedPhoto
// above). Best-effort: a missing file shouldn't block removing the order's reference to it.
const deletePhotoFile = (photoUrl) => {
  const relative = photoUrl.replace(/^\/uploads\//, '');
  const filePath = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', relative);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      logger.error(`Failed to delete photo file ${filePath}: ${err.message}`);
    }
  });
};

module.exports = { uploadPhotos, saveCompressedPhoto, deletePhotoFile };
