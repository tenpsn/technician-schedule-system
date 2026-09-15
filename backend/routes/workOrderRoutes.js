const express = require('express');
const { Op } = require('sequelize');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { createWorkOrder, approveWorkOrder, rescheduleWorkOrder, cancelWorkOrder, logActualWork } = require('../services/workOrderService');
const logger = require('../config/logger');

const router = express.Router();

const TECHNICIAN_ATTRS = ['id', 'fullName', 'username'];
const APPROVER_ATTRS = ['id', 'fullName'];

const DETAIL_INCLUDE = [
  { model: User, as: 'technician', attributes: [...TECHNICIAN_ATTRS, 'email'] },
  { model: User, as: 'approvedBy', attributes: APPROVER_ATTRS },
  { model: User, as: 'cancelledBy', attributes: APPROVER_ATTRS }
];

// Create Work Order (Planning)
router.post('/', protect, async (req, res) => {
  try {
    const { customerName, customerLocation, workType, description,
            plannedDate, plannedStartTime, plannedEndTime } = req.body;

    // Validation
    if (!customerName || !customerLocation || !workType || !plannedDate) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const workOrder = await createWorkOrder({
      technician: req.user,
      customerName,
      customerLocation,
      workType,
      description,
      plannedDate,
      plannedStartTime,
      plannedEndTime
    });

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

    if (year) {
      const startDate = month ? new Date(year, parseInt(month) - 1, 1) : new Date(year, 0, 1);
      const endDate = month ? new Date(year, parseInt(month), 1) : new Date(parseInt(year) + 1, 0, 1);
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

    await approveWorkOrder(order, {
      approvedById: req.user.id, approvedByName: req.user.fullName, approvalNote, actorLabel: req.user.username
    });
    await order.reload({ include: DETAIL_INCLUDE });

    res.json(order);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    logger.error(`Approve error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Update Actual (Technician)
router.patch('/:id/actual', protect, async (req, res) => {
  try {
    const { actualDate, actualStartTime, actualEndTime,
            actualLocation, actualDescription,
            repairCompleted, repairIncompleteReason, installationDelivered } = req.body;

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

    await logActualWork(order, {
      actualDate, actualStartTime, actualEndTime, actualLocation, actualDescription,
      repairCompleted, repairIncompleteReason, installationDelivered,
      recordedById: req.user.id, actorLabel: req.user.username
    });

    res.json(order);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
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

    await rescheduleWorkOrder(order, {
      newDate, reason, changedById: req.user.id, changedByName: req.user.fullName, actorLabel: req.user.username
    });

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

    // Check permission: owner or supervisor/admin
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = req.user.role === 'supervisor' || req.user.role === 'admin';

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({ message: 'ไม่มีสิทธิยกเลิกงานนี้' });
    }

    await cancelWorkOrder(order, {
      cancelReason, cancelledById: req.user.id,
      isOwnerCancelling: isOwner, isSupervisorCancelling: isSupervisor, actorLabel: req.user.username
    });

    await order.reload({ include: DETAIL_INCLUDE });

    res.json({
      success: true,
      message: 'ยกเลิกงานสำเร็จ',
      order
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
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
