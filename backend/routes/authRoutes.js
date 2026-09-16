const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const loginAttempts = require('../utils/loginAttempts');
const { sendServerError } = require('../utils/httpErrors');
const logger = require('../config/logger');

const router = express.Router();

// Register (Admin only)
router.post('/register', protect, authorize('admin'), async (req, res) => {
  try {
    const { username, password, fullName, role, email, phone } = req.body;

    // Validation
    if (!username || !password || !fullName) {
      return res.status(400).json({ code: 'missing_required_fields', message: 'Please provide all required fields' });
    }

    const userExists = await User.findOne({ where: { username } });
    if (userExists) {
      return res.status(400).json({ code: 'username_exists', message: 'Username already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      password: hashedPassword,
      fullName,
      role: role || 'technician',
      email,
      phone
    });

    logger.info(`User registered: ${username} (${user.id})`);

    res.status(201).json({
      _id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      email: user.email
    });
  } catch (error) {
    logger.error(`Register error: ${error.message}`);
    sendServerError(res);
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ code: 'missing_login_fields', message: 'Please provide username and password' });
    }

    const attemptKey = username.trim().toLowerCase();
    const lockedMinutes = loginAttempts.checkLocked(attemptKey);
    if (lockedMinutes) {
      // `message` is an English fallback for non-UI API consumers (curl, Postman);
      // the frontend builds its own bilingual text from `code` + `lockedMinutes`.
      return res.status(429).json({
        code: 'login_locked',
        lockedMinutes,
        message: `Too many failed attempts. Try again in ${lockedMinutes} minute(s).`
      });
    }

    const user = await User.findOne({ where: { username } });

    if (!user) {
      const remainingAttempts = loginAttempts.recordFailure(attemptKey);
      return res.status(401).json({ code: 'invalid_credentials', remainingAttempts, message: 'Invalid credentials' });
    }

    if (!user.active) {
      return res.status(401).json({ code: 'account_deactivated', message: 'Account is deactivated' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (user && isPasswordMatch) {
      loginAttempts.recordSuccess(attemptKey);
      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      logger.info(`User logged in: ${username}`);

      res.json({
        _id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        email: user.email,
        token
      });
    } else {
      const remainingAttempts = loginAttempts.recordFailure(attemptKey);
      res.status(401).json({ code: 'invalid_credentials', remainingAttempts, message: 'Invalid credentials' });
    }
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    sendServerError(res);
  }
});

// Get current user
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    res.json(user);
  } catch (error) {
    logger.error(`Get current user error: ${error.message}`);
    sendServerError(res);
  }
});

// Update my own profile (any authenticated user)
router.patch('/me', protect, async (req, res) => {
  try {
    const { fullName, email, phone, password, currentPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ code: 'current_password_required', message: 'Current password is required to change password' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ code: 'current_password_incorrect', message: 'Current password is incorrect' });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;

    await user.save();
    logger.info(`User updated own profile: ${user.username}`);
    res.json(user);
  } catch (error) {
    logger.error(`Update profile error: ${error.message}`);
    sendServerError(res);
  }
});

// Get all users (Admin/Supervisor only)
router.get('/users', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { role, active } = req.query;
    const where = {};
    if (role) where.role = role;
    if (active === 'all') {
      // no active filter - management page needs to see deactivated accounts too
    } else if (active === 'false') {
      where.active = false;
    } else {
      where.active = true;
    }

    const users = await User.findAll({ where, order: [['fullName', 'ASC']] });
    res.json(users);
  } catch (error) {
    logger.error(`Get users error: ${error.message}`);
    sendServerError(res);
  }
});

// Update a user - role, active status, contact info (Admin only)
router.patch('/users/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ code: 'user_not_found', message: 'User not found' });
    }

    const { fullName, role, email, phone, active, password } = req.body;

    if (active === false && user.id === req.user.id) {
      return res.status(400).json({ code: 'cannot_deactivate_self', message: 'You cannot deactivate your own account' });
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (role !== undefined) user.role = role;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (active !== undefined) user.active = active;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();
    logger.info(`User updated: ${user.username} by ${req.user.username}`);
    res.json(user);
  } catch (error) {
    logger.error(`Update user error: ${error.message}`);
    sendServerError(res);
  }
});

module.exports = router;
