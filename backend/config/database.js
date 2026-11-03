require('dotenv').config();
const { Sequelize } = require('sequelize');
const logger = require('./logger');

// แยกค่าเชื่อมต่อเป็นทีละตัวแบบ JPS-web รหัสที่มีเครื่องหมายพิเศษจึงใส่ได้ตรงๆ
// ตอนเทสใช้ DB_NAME_TEST ถ้าไม่ได้ตั้งไว้จะใช้ DB_NAME แทน
const dbName = process.env.NODE_ENV === 'test'
  ? (process.env.DB_NAME_TEST || process.env.DB_NAME)
  : process.env.DB_NAME;

const sequelize = new Sequelize(dbName, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false,
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    // ตอนเทส ชุดทดสอบเองจะเป็นคนสั่ง sync แบบ force เอง กันชนกับการเรียกตรงนี้ที่รันตอนเริ่มเซิร์ฟเวอร์แบบไม่รอ await
    if (process.env.NODE_ENV !== 'test') {
      await sequelize.sync({ alter: true });
    }
    logger.info(`✅ PostgreSQL Connected: ${sequelize.config.database}`);
  } catch (error) {
    logger.error(`❌ PostgreSQL Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
