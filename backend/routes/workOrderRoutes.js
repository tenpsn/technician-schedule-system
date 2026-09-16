const express = require('express');
const { Op } = require('sequelize');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { uploadPhotos, saveCompressedPhoto, deletePhotoFile } = require('../middleware/upload');
const { createWorkOrder, approveWorkOrder, rescheduleWorkOrder, cancelWorkOrder, logActualWork, addPhotos, removePhoto } = require('../services/workOrderService');
const { sendServerError } = require('../utils/httpErrors');
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
      return res.status(400).json({ code: 'missing_required_fields', message: 'Please provide all required fields' });
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
    sendServerError(res);
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
    sendServerError(res);
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
    sendServerError(res);
  }
});

// Get single work order
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await WorkOrder.findByPk(req.params.id, {
      include: DETAIL_INCLUDE
    });

    if (!order) {
      return res.status(404).json({ code: 'work_order_not_found', message: 'Work order not found' });
    }

    // Check permission
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = req.user.role === 'supervisor' || req.user.role === 'admin';

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({ code: 'not_authorized_view_order', message: 'Not authorized to view this order' });
    }

    res.json(order);
  } catch (error) {
    logger.error(`Get order error: ${error.message}`);
    sendServerError(res);
  }
});

// Approve Work Order (Supervisor)
router.patch('/:id/approve', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { approvalNote } = req.body;
    const order = await WorkOrder.findByPk(req.params.id, { include: DETAIL_INCLUDE });

    if (!order) {
      return res.status(404).json({ code: 'work_order_not_found', message: 'Work order not found' });
    }

    await approveWorkOrder(order, {
      approvedById: req.user.id, approvedByName: req.user.fullName, approvalNote, actorLabel: req.user.username
    });
    await order.reload({ include: DETAIL_INCLUDE });

    res.json(order);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ code: error.code, data: error.data, message: error.message });
    }
    logger.error(`Approve error: ${error.message}`);
    sendServerError(res);
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
      return res.status(404).json({ code: 'work_order_not_found', message: 'Work order not found' });
    }

    // Check ownership
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = req.user.role === 'supervisor' || req.user.role === 'admin';

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({ code: 'not_authorized', message: 'Not authorized' });
    }

    await logActualWork(order, {
      actualDate, actualStartTime, actualEndTime, actualLocation, actualDescription,
      repairCompleted, repairIncompleteReason, installationDelivered,
      recordedById: req.user.id, actorLabel: req.user.username
    });

    res.json(order);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ code: error.code, data: error.data, message: error.message });
    }
    logger.error(`Update actual error: ${error.message}`);
    sendServerError(res);
  }
});

// Upload job-site photos (Technician)
router.patch('/:id/photos', protect, uploadPhotos, async (req, res) => {
  try {
    const order = await WorkOrder.findByPk(req.params.id, { include: DETAIL_INCLUDE });

    if (!order) {
      return res.status(404).json({ code: 'work_order_not_found', message: 'Work order not found' });
    }

    // Check ownership
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = req.user.role === 'supervisor' || req.user.role === 'admin';

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({ code: 'not_authorized', message: 'Not authorized' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ code: 'photos_required', message: 'Please select at least 1 photo' });
    }

    const results = await Promise.allSettled(req.files.map(f => saveCompressedPhoto(order.id, f.buffer)));
    const failure = results.find(r => r.status === 'rejected');
    if (failure) {
      // One bad file shouldn't leave the good ones behind as orphans with no
      // order.photos reference — clean up everything this batch wrote.
      results.filter(r => r.status === 'fulfilled').forEach(r => deletePhotoFile(r.value));
      logger.error(`Photo compression error: ${failure.reason.message}`);
      return res.status(400).json({ code: 'photo_invalid', message: 'Photo file is invalid or corrupted' });
    }
    const urls = results.map(r => r.value);

    await addPhotos(order, urls, req.user.username);

    res.json(order);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ code: error.code, data: error.data, message: error.message });
    }
    logger.error(`Upload photos error: ${error.message}`);
    sendServerError(res);
  }
});

// Remove a job-site photo (Technician / Supervisor)
router.delete('/:id/photos', protect, async (req, res) => {
  try {
    const { photo } = req.body;
    if (!photo) {
      return res.status(400).json({ code: 'photo_to_delete_required', message: 'Please specify which photo to delete' });
    }

    const order = await WorkOrder.findByPk(req.params.id, { include: DETAIL_INCLUDE });

    if (!order) {
      return res.status(404).json({ code: 'work_order_not_found', message: 'Work order not found' });
    }

    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = req.user.role === 'supervisor' || req.user.role === 'admin';

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({ code: 'not_authorized', message: 'Not authorized' });
    }

    await removePhoto(order, photo, req.user.username);
    deletePhotoFile(photo);

    res.json(order);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ code: error.code, data: error.data, message: error.message });
    }
    logger.error(`Delete photo error: ${error.message}`);
    sendServerError(res);
  }
});

// Reschedule Work Order
router.patch('/:id/reschedule', protect, async (req, res) => {
  try {
    const { newDate, reason } = req.body;

    if (!newDate || !reason) {
      return res.status(400).json({ code: 'reschedule_fields_required', message: 'New date and reason are required' });
    }

    const order = await WorkOrder.findByPk(req.params.id, { include: DETAIL_INCLUDE });

    if (!order) {
      return res.status(404).json({ code: 'work_order_not_found', message: 'Work order not found' });
    }

    // Check ownership — matches cancel/approve/actual/photos, which all allow
    // supervisor too, not just admin (this one used to be the odd one out).
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = ['supervisor', 'admin'].includes(req.user.role);
    if (!isOwner && !isSupervisor) {
      return res.status(403).json({ code: 'not_authorized_reschedule', message: 'Not authorized to reschedule' });
    }

    await rescheduleWorkOrder(order, {
      newDate, reason, changedById: req.user.id, changedByName: req.user.fullName, actorLabel: req.user.username
    });

    res.json(order);
  } catch (error) {
    logger.error(`Reschedule error: ${error.message}`);
    sendServerError(res);
  }
});

// Cancel Work Order
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const { cancelReason } = req.body;

    // Validate reason
    if (!cancelReason || cancelReason.trim() === '') {
      return res.status(400).json({ code: 'cancel_reason_required', message: 'Please state a reason for cancelling' });
    }

    const order = await WorkOrder.findByPk(req.params.id, { include: DETAIL_INCLUDE });

    if (!order) {
      return res.status(404).json({ code: 'work_order_not_found', message: 'Work order not found' });
    }

    // Check permission: owner or supervisor/admin
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = req.user.role === 'supervisor' || req.user.role === 'admin';

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({ code: 'not_authorized_cancel', message: 'Not authorized to cancel this job' });
    }

    await cancelWorkOrder(order, {
      cancelReason, cancelledById: req.user.id,
      isOwnerCancelling: isOwner, isSupervisorCancelling: isSupervisor, actorLabel: req.user.username
    });

    await order.reload({ include: DETAIL_INCLUDE });

    res.json({
      success: true,
      code: 'work_order_cancelled',
      message: 'Cancelled successfully',
      order
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ code: error.code, data: error.data, message: error.message });
    }
    logger.error(`Cancel work order error: ${error.message}`);
    sendServerError(res);
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
    sendServerError(res);
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
    sendServerError(res);
  }
});

module.exports = router;
