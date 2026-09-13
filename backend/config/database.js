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
    // In test mode, the test suite itself owns schema sync (force: true)
    // to avoid racing this call, which runs unawaited at server startup.
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
