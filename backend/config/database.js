require('dotenv').config();
const { Sequelize } = require('sequelize');
const logger = require('./logger');

const dbUrl = process.env.NODE_ENV === 'test'
  ? (process.env.DATABASE_URL_TEST || process.env.DATABASE_URL)
  : process.env.DATABASE_URL;

const sequelize = new Sequelize(dbUrl, {
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
