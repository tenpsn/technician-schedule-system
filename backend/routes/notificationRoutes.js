const express = require('express');
const Notification = require('../models/Notification');
const WorkOrder = require('../models/WorkOrder');
const { protect } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Get my notifications
router.get('/', protect, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const notifications = await Notification.findAll({
      where: { recipientId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      include: [{ model: WorkOrder, as: 'relatedWorkOrder', attributes: ['srNumber', 'customerName'] }]
    });
    res.json(notifications);
  } catch (error) {
    logger.error(`Get notifications error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Mark as read
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.recipientId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    notification.isRead = true;
    await notification.save();

    res.json({ success: true });
  } catch (error) {
    logger.error(`Mark read error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Mark all as read
router.patch('/read-all', protect, async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { recipientId: req.user.id, isRead: false } }
    );
    res.json({ success: true });
  } catch (error) {
    logger.error(`Mark all read error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Get unread count
router.get('/unread/count', protect, async (req, res) => {
  try {
    const count = await Notification.count({
      where: { recipientId: req.user.id, isRead: false }
    });
    res.json({ count });
  } catch (error) {
    logger.error(`Get count error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
