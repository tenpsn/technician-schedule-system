const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Register (Admin only)
router.post('/register', protect, authorize('admin'), async (req, res) => {
  try {
    const { username, password, fullName, role, email, phone } = req.body;

    // Validation
    if (!username || !password || !fullName) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const userExists = await User.findOne({ where: { username } });
    if (userExists) {
      return res.status(400).json({ message: 'Username already exists' });
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
    res.status(500).json({ message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password' });
    }

    const user = await User.findOne({ where: { username } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.active) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (user && isPasswordMatch) {
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
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Get current user
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    res.json(user);
  } catch (error) {
    logger.error(`Get current user error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Update my own profile (any authenticated user)
router.patch('/me', protect, async (req, res) => {
  try {
    const { fullName, email, phone, password, currentPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'กรุณากรอกรหัสผ่านปัจจุบันเพื่อเปลี่ยนรหัสผ่าน' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
});

// Update a user - role, active status, contact info (Admin only)
router.patch('/users/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { fullName, role, email, phone, active, password } = req.body;

    if (active === false && user.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
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
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
