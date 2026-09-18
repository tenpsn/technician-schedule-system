// ตั้ง TZ ก่อน require อื่นเพราะบางโมดูลอ่านเวลาท้องถิ่นตอน require ทันที
// เพื่อให้ Date และ log ทั้งหมดใช้เวลาไทยเสมอ ไม่ขึ้นกับ default ของเครื่อง
process.env.TZ = process.env.TZ || 'Asia/Bangkok';

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { connectDB } = require('./config/database');
const logger = require('./config/logger');

// นำเข้า routes ต่างๆ
const authRoutes = require('./routes/authRoutes');
const workOrderRoutes = require('./routes/workOrderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const contractRoutes = require('./routes/contractRoutes');
const lineRoutes = require('./routes/lineRoutes');
const provinceRoutes = require('./routes/provinceRoutes');

// งาน cron
require('./cron/overdueCheck');

// โหลดตัวแปรสภาพแวดล้อม
dotenv.config();

// เชื่อมต่อฐานข้อมูล
connectDB();

const app = express();

// ตัวแปลง body ของ request verify เก็บ raw bytes ของ request ไว้ เพราะ LINE webhook ต้องใช้ bytes ดิบ
// ไม่ใช่ object ที่ parse แล้ว ไปตรวจสอบลายเซ็น x line signature แบบ HMAC
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true }));

// ตั้งค่า CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL || 'http://localhost:4200')
    : true,
  credentials: true
}));

// บันทึก log คำขอที่เข้ามา
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ไฟล์ที่อัปโหลด เช่น รูปหน้างาน
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// เส้นทาง API ทั้งหมด
app.use('/api/auth', authRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/line', lineRoutes);
app.use('/api/provinces', provinceRoutes);

// ตรวจสอบสถานะเซิร์ฟเวอร์
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Technician Schedule Management System'
  });
});

// ตัวจัดการ error กลาง
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3000;

// bind port เฉพาะตอนรันไฟล์นี้ตรงๆ เทสจะ require app ไปใช้กับ supertest เองโดยไม่ต้อง listen
// ถ้า listen ซ้ำจะไปชนพอร์ตเดียวกันกับ dev server หรือ supertest ที่สร้างเซิร์ฟเวอร์ชั่วคราวของตัวเอง
if (require.main === module) {
  const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });

  // ดักจับ promise rejection ที่ไม่ได้ถูกจัดการ
  process.on('unhandledRejection', (err) => {
    logger.error(`❌ Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
}

module.exports = app;
