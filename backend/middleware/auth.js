const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findByPk(decoded.id);
      
      if (!req.user) {
        return res.status(401).json({ code: 'session_user_not_found', message: 'User not found' });
      }
      
      if (!req.user.active) {
        return res.status(401).json({ code: 'account_deactivated', message: 'User account is deactivated' });
      }
      
      next();
    } catch (error) {
      logger.error(`Auth error: ${error.message}`);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ code: 'token_expired', message: 'Token expired. Please login again.' });
      }
      return res.status(401).json({ code: 'invalid_token', message: 'Not authorized, invalid token' });
    }
  } else {
    return res.status(401).json({ code: 'no_token', message: 'No token provided' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      logger.warn(`Authorization failed: ${req.user.username} tried to access ${req.path}`);
      // ส่ง code ไปด้วยให้หน้าเว็บแปลเป็นภาษาที่ผู้ใช้เลือก ดู errorMessage ใน i18n.service.ts
      return res.status(403).json({
        code: 'role_not_allowed',
        message: `Role ${req.user.role} is not allowed to access this resource`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
