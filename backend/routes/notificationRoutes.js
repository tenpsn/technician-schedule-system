const express = require('express');
const Notification = require('../models/Notification');
const WorkOrder = require('../models/WorkOrder');
const { protect } = require('../middleware/auth');
const { sendServerError } = require('../utils/httpErrors');
const logger = require('../config/logger');

const router = express.Router();

// ดึงการแจ้งเตือนของตัวเอง
router.get('/', protect, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const notifications = await Notification.findAll({
      where: { recipientId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      include: [{ model: WorkOrder, as: 'relatedWorkOrder', attributes: ['id', 'srNumber', 'customerName'] }]
    });
    res.json(notifications);
  } catch (error) {
    logger.error(`Get notifications error: ${error.message}`);
    sendServerError(res);
  }
});

// ทำเครื่องหมายว่าอ่านแล้ว
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);

    if (!notification) {
      return res.status(404).json({ code: 'notification_not_found', message: 'Notification not found' });
    }

    if (notification.recipientId !== req.user.id) {
      return res.status(403).json({ code: 'not_authorized', message: 'Not authorized' });
    }

    notification.isRead = true;
    await notification.save();

    res.json({ success: true });
  } catch (error) {
    logger.error(`Mark read error: ${error.message}`);
    sendServerError(res);
  }
});

// ทำเครื่องหมายว่าอ่านแล้วทั้งหมด
router.patch('/read-all', protect, async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { recipientId: req.user.id, isRead: false } }
    );
    res.json({ success: true });
  } catch (error) {
    logger.error(`Mark all read error: ${error.message}`);
    sendServerError(res);
  }
});

// ดึงจำนวนที่ยังไม่อ่าน
router.get('/unread/count', protect, async (req, res) => {
  try {
    const count = await Notification.count({
      where: { recipientId: req.user.id, isRead: false }
    });
    res.json({ count });
  } catch (error) {
    logger.error(`Get count error: ${error.message}`);
    sendServerError(res);
  }
});

module.exports = router;
