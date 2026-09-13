const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Register (Admin only in production)
router.post('/register', async (req, res) => {
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

// Get all users (Admin/Supervisor only)
router.get('/users', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const users = await User.findAll({ where: { active: true } });
    res.json(users);
  } catch (error) {
    logger.error(`Get users error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
