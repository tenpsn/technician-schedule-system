const express = require('express');
const { Op } = require('sequelize');
const WorkOrder = require('../models/WorkOrder');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

const TECHNICIAN_ATTRS = ['id', 'fullName', 'username'];
const APPROVER_ATTRS = ['id', 'fullName'];

const DETAIL_INCLUDE = [
  { model: User, as: 'technician', attributes: [...TECHNICIAN_ATTRS, 'email'] },
  { model: User, as: 'approvedBy', attributes: APPROVER_ATTRS },
  { model: User, as: 'cancelledBy', attributes: APPROVER_ATTRS }
];

// Helper: Generate SR Number
const generateSRNumber = async () => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = await WorkOrder.count({
    where: { srNumber: { [Op.like]: `SR-${yearMonth}%` } }
  });
  return `SR-${yearMonth}-${String(count + 1).padStart(4, '0')}`;
};

// Create Work Order (Planning)
router.post('/', protect, async (req, res) => {
  try {
    const { customerName, customerLocation, workType, description,
            plannedDate, plannedStartTime, plannedEndTime } = req.body;

    // Validation
    if (!customerName || !customerLocation || !workType || !plannedDate) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const srNumber = await generateSRNumber();

    const workOrder = await WorkOrder.create({
      srNumber,
      technicianId: req.user.id,
      customerName,
      customerLocation,
      workType,
      description,
      plannedDate,
      plannedStartTime,
      plannedEndTime,
      status: 'pending_approval'
    });

    // Notify supervisor
    const supervisors = await User.findAll({ where: { role: { [Op.in]: ['supervisor', 'admin'] } } });
    for (const sup of supervisors) {
      await Notification.create({
        recipientId: sup.id,
        type: 'approval_needed',
        title: '📋 รออนุมัติแผนงาน',
        message: `ช่าง ${req.user.fullName} เสนอแผนงาน ${srNumber} - ${customerName}`,
        relatedWorkOrderId: workOrder.id
      });
    }

    logger.info(`Work order created: ${srNumber} by ${req.user.username}`);
    res.status(201).json(workOrder);
  } catch (error) {
    logger.error(`Create work order error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Get my work orders
router.get('/my', protect, async (req, res) => {
  try {
    const { month, year, status } = req.query;
    const where = { technicianId: req.user.id };

    if (month && year) {
      const startDate = new Date(year, parseInt(month) - 1, 1);
      const endDate = new Date(year, parseInt(month), 1);
      where.plannedDate = { [Op.gte]: startDate, [Op.lt]: endDate };
    }

    if (status) where.status = status;

    const orders = await WorkOrder.findAll({
      where,
      include: [
        { model: User, as: 'technician', attributes: TECHNICIAN_ATTRS },
        { model: User, as: 'approvedBy', attributes: APPROVER_ATTRS },
        { model: User, as: 'cancelledBy', attributes: APPROVER_ATTRS }
      ],
      order: [['plannedDate', 'ASC']]
    });

    res.json(orders);
  } catch (error) {
    logger.error(`Get my orders error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Get all work orders (Supervisor)
router.get('/all', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { month, year, technician, status } = req.query;
    const where = {};

    if (month && year) {
      const startDate = new Date(year, parseInt(month) - 1, 1);
      const endDate = new Date(year, parseInt(month), 1);
      where.plannedDate = { [Op.gte]: startDate, [Op.lt]: endDate };
    }

    if (technician) where.technicianId = technician;
    if (status) where.status = status;

    const orders = await WorkOrder.findAll({
      where,
      include: [
        { model: User, as: 'technician', attributes: TECHNICIAN_ATTRS },
        { model: User, as: 'approvedBy', attributes: APPROVER_ATTRS },
        { model: User, as: 'cancelledBy', attributes: APPROVER_ATTRS }
      ],
      order: [['plannedDate', 'ASC']]
    });

    res.json(orders);
  } catch (error) {
    logger.error(`Get all orders error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Get single work order
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await WorkOrder.findByPk(req.params.id, {
      include: DETAIL_INCLUDE
    });

    if (!order) {
      return res.status(404).json({ message: 'Work order not found' });
    }

    // Check permission
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = req.user.role === 'supervisor' || req.user.role === 'admin';

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.json(order);
  } catch (error) {
    logger.error(`Get order error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Approve Work Order (Supervisor)
router.patch('/:id/approve', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { approvalNote } = req.body;
    const order = await WorkOrder.findByPk(req.params.id, { include: DETAIL_INCLUDE });

    if (!order) {
      return res.status(404).json({ message: 'Work order not found' });
    }

    if (order.status !== 'pending_approval') {
      return res.status(400).json({ message: 'Work order is not pending approval' });
    }

    order.status = 'approved';
    order.approvedById = req.user.id;
    order.approvedAt = new Date();
    if (approvalNote) order.approvalNote = approvalNote;
    await order.save();
    await order.reload({ include: DETAIL_INCLUDE });

    // Notify technician
    await Notification.create({
      recipientId: order.technicianId,
      type: 'approval_needed',
      title: '✅ แผนงานได้รับการอนุมัติ',
      message: `งาน ${order.srNumber} (${order.customerName}) ได้รับการอนุมัติแล้ว`,
      relatedWorkOrderId: order.id
    });

    logger.info(`Work order approved: ${order.srNumber} by ${req.user.username}`);
    res.json(order);
  } catch (error) {
    logger.error(`Approve error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Update Actual (Technician)
router.patch('/:id/actual', protect, async (req, res) => {
  try {
    const { actualDate, actualStartTime, actualEndTime,
            actualLocation, actualDescription } = req.body;

    if (!actualDescription) {
      return res.status(400).json({ message: 'Actual description is required' });
    }

    const order = await WorkOrder.findByPk(req.params.id, { include: DETAIL_INCLUDE });

    if (!order) {
      return res.status(404).json({ message: 'Work order not found' });
    }

    // Check ownership
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = req.user.role === 'supervisor' || req.user.role === 'admin';

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    order.actualDate = actualDate;
    order.actualStartTime = actualStartTime;
    order.actualEndTime = actualEndTime;
    order.actualLocation = actualLocation;
    order.actualDescription = actualDescription;
    order.status = 'completed';
    await order.save();

    logger.info(`Work order completed: ${order.srNumber} by ${req.user.username}`);
    res.json(order);
  } catch (error) {
    logger.error(`Update actual error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Reschedule Work Order
router.patch('/:id/reschedule', protect, async (req, res) => {
  try {
    const { newDate, reason } = req.body;

    if (!newDate || !reason) {
      return res.status(400).json({ message: 'New date and reason are required' });
    }

    const order = await WorkOrder.findByPk(req.params.id, { include: DETAIL_INCLUDE });

    if (!order) {
      return res.status(404).json({ message: 'Work order not found' });
    }

    // Check ownership
    const isOwner = order.technicianId === req.user.id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to reschedule' });
    }

    // Add to history
    const fromDate = order.plannedDate;
    const history = [...(order.rescheduleHistory || []), {
      fromDate,
      toDate: new Date(newDate),
      reason,
      changedBy: req.user.id,
      changedAt: new Date()
    }];
    order.rescheduleHistory = history;
    order.changed('rescheduleHistory', true);

    order.plannedDate = new Date(newDate);
    order.status = 'pending_approval';
    order.isOverdue = false;
    order.overdueDays = 0;
    await order.save();

    // Notify supervisor
    const supervisors = await User.findAll({ where: { role: { [Op.in]: ['supervisor', 'admin'] } } });
    for (const sup of supervisors) {
      await Notification.create({
        recipientId: sup.id,
        type: 'rescheduled',
        title: '🔄 งานถูกเลื่อน',
        message: `งาน ${order.srNumber} เลื่อนจาก ${new Date(fromDate).toLocaleDateString()} เป็น ${newDate}\nเหตุผล: ${reason}`,
        relatedWorkOrderId: order.id
      });
    }

    logger.info(`Work order rescheduled: ${order.srNumber} to ${newDate}`);
    res.json(order);
  } catch (error) {
    logger.error(`Reschedule error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Cancel Work Order
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const { cancelReason } = req.body;

    // Validate reason
    if (!cancelReason || cancelReason.trim() === '') {
      return res.status(400).json({ message: 'กรุณาระบุเหตุผลการยกเลิก' });
    }

    const order = await WorkOrder.findByPk(req.params.id, { include: DETAIL_INCLUDE });

    if (!order) {
      return res.status(404).json({ message: 'ไม่พบงาน' });
    }

    // Check if can be cancelled
    const cancellableStatuses = ['draft', 'pending_approval', 'approved', 'overdue', 'in_progress'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        message: `ไม่สามารถยกเลิกงานที่มีสถานะ "${order.status}" ได้`
      });
    }

    // Check permission: owner or supervisor/admin
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = req.user.role === 'supervisor' || req.user.role === 'admin';

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({ message: 'ไม่มีสิทธิยกเลิกงานนี้' });
    }

    // Update order
    order.status = 'cancelled';
    order.cancelledById = req.user.id;
    order.cancelledAt = new Date();
    order.cancelReason = cancelReason.trim();
    await order.save();

    // Log the cancellation
    logger.info(`Work order cancelled: ${order.srNumber} by ${req.user.username}. Reason: ${cancelReason}`);

    // Notify relevant parties
    if (!isOwner) {
      // Supervisor cancelled - notify technician
      await Notification.create({
        recipientId: order.technicianId,
        type: 'cancelled',
        title: '🚫 งานถูกยกเลิกโดยหัวหน้า',
        message: `งาน ${order.srNumber} (${order.customerName}) ถูกยกเลิก\nเหตุผล: ${cancelReason}`,
        relatedWorkOrderId: order.id
      });
    } else if (!isSupervisor) {
      // Technician cancelled - notify supervisors
      const supervisors = await User.findAll({ where: { role: { [Op.in]: ['supervisor', 'admin'] } } });
      for (const sup of supervisors) {
        await Notification.create({
          recipientId: sup.id,
          type: 'cancelled',
          title: '🚫 ช่างขอยกเลิกงาน',
          message: `${order.technician.fullName} ยกเลิกงาน ${order.srNumber} (${order.customerName})\nเหตุผล: ${cancelReason}`,
          relatedWorkOrderId: order.id
        });
      }
    }

    await order.reload({ include: DETAIL_INCLUDE });

    res.json({
      success: true,
      message: 'ยกเลิกงานสำเร็จ',
      order
    });
  } catch (error) {
    logger.error(`Cancel work order error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Get overdue work orders
router.get('/status/overdue', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const orders = await WorkOrder.findAll({
      where: { status: 'overdue', isOverdue: true },
      include: [{ model: User, as: 'technician', attributes: TECHNICIAN_ATTRS }],
      order: [['overdueDays', 'DESC']]
    });

    res.json(orders);
  } catch (error) {
    logger.error(`Get overdue error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Get cancelled work orders (for report/history)
router.get('/status/cancelled', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { month, year } = req.query;
    const where = { status: 'cancelled' };

    if (month && year) {
      const startDate = new Date(year, parseInt(month) - 1, 1);
      const endDate = new Date(year, parseInt(month), 1);
      where.cancelledAt = { [Op.gte]: startDate, [Op.lt]: endDate };
    }

    const orders = await WorkOrder.findAll({
      where,
      include: [
        { model: User, as: 'technician', attributes: TECHNICIAN_ATTRS },
        { model: User, as: 'cancelledBy', attributes: TECHNICIAN_ATTRS }
      ],
      order: [['cancelledAt', 'DESC']]
    });

    res.json(orders);
  } catch (error) {
    logger.error(`Get cancelled orders error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
