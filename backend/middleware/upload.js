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
const AVATAR_SIZE = 256;

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error('Only jpg, png and webp images are allowed');
    error.code = 'PHOTO_TYPE_INVALID';
    return cb(error);
  }
  cb(null, true);
};

// เก็บไฟล์ในหน่วยความจำก่อนแทนเขียนลงดิสก์ทันที เพราะ route จะบีบอัดผ่าน sharp ก่อน MAX_PHOTO_SIZE_MB เลยจำกัดแค่ไฟล์ต้นทาง ไม่ใช่ไฟล์ที่เก็บจริง
// MAX_FILES_PER_UPLOAD จำกัดจำนวนไฟล์ในหน่วยความจำต่อ request เพราะ memoryStorage ไม่จำกัดจำนวนไฟล์เอง ถ้าไม่กันไว้อาจโดนถล่ม RAM ได้
const photosUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES_PER_UPLOAD }
}).array('photos', MAX_FILES_PER_UPLOAD);

// ครอบ multer ไว้เพื่อให้ error เช่น ไฟล์ใหญ่เกินหรือชนิดผิด ตอบกลับเป็น 400 แทนที่จะหลุดไปเจอ error handler 500 ทั่วไป
const uploadPhotos = (req, res, next) => {
  photosUpload(req, res, (err) => {
    if (err) {
      // แปลง error ของ multer เป็น code ให้หน้าเว็บแปลตามภาษาที่ผู้ใช้เลือก
      const code = { LIMIT_FILE_SIZE: 'photo_too_large', LIMIT_FILE_COUNT: 'too_many_photos', LIMIT_UNEXPECTED_FILE: 'too_many_photos',
        PHOTO_TYPE_INVALID: 'photo_type_invalid' }[err.code] || 'photo_invalid';
      return res.status(400).json({ code, data: { maxMb: MAX_FILE_SIZE_BYTES / 1024 / 1024, maxFiles: MAX_FILES_PER_UPLOAD }, message: err.message });
    }
    next();
  });
};

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 }
}).single('avatar');

// รูปโปรไฟล์รับทีละรูป ตอบ error รูปแบบเดียวกับ uploadPhotos
const uploadAvatar = (req, res, next) => {
  avatarUpload(req, res, (err) => {
    if (err) {
      const code = { LIMIT_FILE_SIZE: 'photo_too_large', PHOTO_TYPE_INVALID: 'photo_type_invalid' }[err.code] || 'photo_invalid';
      return res.status(400).json({ code, data: { maxMb: MAX_FILE_SIZE_BYTES / 1024 / 1024 }, message: err.message });
    }
    next();
  });
};

// ปรับขนาดความกว้างสูงสุดแล้วแปลงเป็น JPEG ให้รูปจากกล้องมือถือที่มักหนักหลาย MB เหลือขนาดเล็กลงมาก
// ส่งออกเป็น jpg เสมอไม่ว่าไฟล์ต้นฉบับจะเป็นแบบไหน เพราะรูปหน้างานไม่ต้องใช้ความโปร่งใสของ PNG หรือ WebP และรูปแบบเดียวคุมการบีบอัดได้ง่ายกว่า
const saveCompressedPhoto = async (orderId, buffer) => {
  const dir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', 'work-orders', orderId);
  await fsp.mkdir(dir, { recursive: true });

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
  const filePath = path.join(dir, filename);

  await sharp(buffer)
    .rotate() // ปรับทิศทางตาม EXIF ก่อนที่จะถูกลบไปตอนแปลงไฟล์ใหม่
    .resize({ width: MAX_PHOTO_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(filePath);

  return `/uploads/work-orders/${orderId}/${filename}`;
};

// ครอปรูปโปรไฟล์เป็นสี่เหลี่ยมจัตุรัสขนาดเล็ก เพราะแสดงแค่ในกรอบเล็กๆ ไม่ต้องเก็บรูปใหญ่
const saveAvatar = async (userId, buffer) => {
  const dir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', 'avatars');
  await fsp.mkdir(dir, { recursive: true });

  const filename = `${userId}-${Date.now()}.jpg`;
  await sharp(buffer)
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toFile(path.join(dir, filename));

  return `/uploads/avatars/${filename}`;
};

// photoUrl มีรูปแบบเป็น path ใต้ uploads ตามด้วยรหัสงานและชื่อไฟล์ ดู saveCompressedPhoto ด้านบน
// ถ้าหาไฟล์ไม่เจอก็ไม่เป็นไร ไม่ควรบล็อกการลบ reference ของ order
const deletePhotoFile = (photoUrl) => {
  const relative = photoUrl.replace(/^\/uploads\//, '');
  const filePath = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', relative);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      logger.error(`Failed to delete photo file ${filePath}: ${err.message}`);
    }
  });
};

module.exports = { uploadPhotos, saveCompressedPhoto, deletePhotoFile, uploadAvatar, saveAvatar };
