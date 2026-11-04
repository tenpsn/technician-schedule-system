require('dotenv').config();
const { Sequelize } = require('sequelize');
const logger = require('./logger');

// แยกค่าเชื่อมต่อเป็นทีละตัวแบบ JPS-web รหัสที่มีเครื่องหมายพิเศษจึงใส่ได้ตรงๆ
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false,
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    logger.info(`✅ PostgreSQL Connected: ${sequelize.config.database}`);
  } catch (error) {
    logger.error(`❌ PostgreSQL Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
