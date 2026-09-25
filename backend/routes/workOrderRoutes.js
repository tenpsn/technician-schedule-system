const express = require('express');
const { Op } = require('sequelize');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { isSupervisorRole } = require('../config/roles');
const { uploadPhotos, saveCompressedPhoto, deletePhotoFile } = require('../middleware/upload');
const { createWorkOrder, approveWorkOrder, rescheduleWorkOrder, cancelWorkOrder, logActualWork, addPhotos, removePhoto } = require('../services/workOrderService');
const { sendServerError } = require('../utils/httpErrors');
const { computeOverdue } = require('../utils/overdueCalc');
const { WORK_TYPES, REPAIR_TYPE, INSTALLATION_TYPE, OTHER_TYPE } = require('../config/workTypes');
const { monthRangeUTC } = require('../utils/dateRange');
const logger = require('../config/logger');

const router = express.Router();

const TECHNICIAN_ATTRS = ['id', 'fullName', 'username'];
const APPROVER_ATTRS = ['id', 'fullName'];

const DETAIL_INCLUDE = [
  { model: User, as: 'technician', attributes: [...TECHNICIAN_ATTRS, 'email'] },
  { model: User, as: 'approvedBy', attributes: APPROVER_ATTRS },
  { model: User, as: 'cancelledBy', attributes: APPROVER_ATTRS }
];

// สร้างใบงาน ขั้นตอนวางแผน
router.post('/', protect, async (req, res) => {
  try {
    const { customerName, customerLocation, workType, description,
            plannedDate, plannedStartTime, plannedEndTime } = req.body;

    // ตรวจสอบข้อมูล
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

// ดึงใบงานของตัวเอง
router.get('/my', protect, async (req, res) => {
  try {
    const { month, year, status } = req.query;
    const where = { technicianId: req.user.id };

    if (month && year) {
      const { start, end } = monthRangeUTC(year, month);
      where.plannedDate = { [Op.gte]: start, [Op.lt]: end };
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

// ดึงใบงานทั้งหมด สำหรับหัวหน้างาน
router.get('/all', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { month, year, technician, status } = req.query;
    const where = {};

    if (year) {
      const { start, end } = monthRangeUTC(year, month);
      where.plannedDate = { [Op.gte]: start, [Op.lt]: end };
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

// ประเภทงานที่เลือกได้ กับค่าที่นับเป็นซ่อม/ติดตั้ง ให้ frontend ใช้แทนการก็อปเอง
router.get('/work-types', protect, (req, res) => {
  res.json({ types: WORK_TYPES, repairType: REPAIR_TYPE, installationType: INSTALLATION_TYPE, otherType: OTHER_TYPE });
});

// ดึงใบงานรายการเดียว
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await WorkOrder.findByPk(req.params.id, {
      include: DETAIL_INCLUDE
    });

    if (!order) {
      return res.status(404).json({ code: 'work_order_not_found', message: 'Work order not found' });
    }

    // ตรวจสอบสิทธิ์
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = isSupervisorRole(req.user.role);

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({ code: 'not_authorized_view_order', message: 'Not authorized to view this order' });
    }

    res.json(order);
  } catch (error) {
    logger.error(`Get order error: ${error.message}`);
    sendServerError(res);
  }
});

// อนุมัติใบงาน สำหรับหัวหน้างาน
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

// บันทึกผลจริง สำหรับช่าง
router.patch('/:id/actual', protect, async (req, res) => {
  try {
    const { actualDate, actualStartTime, actualEndTime,
            actualLocation, actualDescription,
            repairCompleted, repairIncompleteReason, installationDelivered } = req.body;

    const order = await WorkOrder.findByPk(req.params.id, { include: DETAIL_INCLUDE });

    if (!order) {
      return res.status(404).json({ code: 'work_order_not_found', message: 'Work order not found' });
    }

    // ตรวจสอบว่าเป็นเจ้าของงานหรือไม่
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = isSupervisorRole(req.user.role);

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

// อัปโหลดรูปหน้างาน สำหรับช่าง
router.patch('/:id/photos', protect, uploadPhotos, async (req, res) => {
  try {
    const order = await WorkOrder.findByPk(req.params.id, { include: DETAIL_INCLUDE });

    if (!order) {
      return res.status(404).json({ code: 'work_order_not_found', message: 'Work order not found' });
    }

    // ตรวจสอบว่าเป็นเจ้าของงานหรือไม่
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = isSupervisorRole(req.user.role);

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({ code: 'not_authorized', message: 'Not authorized' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ code: 'photos_required', message: 'Please select at least 1 photo' });
    }

    const results = await Promise.allSettled(req.files.map(f => saveCompressedPhoto(order.id, f.buffer)));
    const failure = results.find(r => r.status === 'rejected');
    if (failure) {
      // ถ้ามีไฟล์เสียแม้แต่ไฟล์เดียว ต้องลบไฟล์ที่อัปโหลดสำเร็จในชุดนี้ทิ้งด้วย
      // กันไม่ให้เหลือไฟล์กำพร้าที่ไม่มีการอ้างอิงใน order.photos
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

// ลบรูปหน้างาน สำหรับช่างหรือหัวหน้างาน
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
    const isSupervisor = isSupervisorRole(req.user.role);

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

// เลื่อนนัดใบงาน
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

    // ตรวจสอบว่าเป็นเจ้าของงาน ให้ตรงกับ cancel approve actual photos ที่อนุญาตหัวหน้างานด้วย
    // ไม่ใช่แค่ admin เหมือนที่เคยเป็นมาก่อน
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = isSupervisorRole(req.user.role);
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

// ยกเลิกใบงาน
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const { cancelReason } = req.body;

    // ตรวจสอบเหตุผล
    if (!cancelReason || cancelReason.trim() === '') {
      return res.status(400).json({ code: 'cancel_reason_required', message: 'Please state a reason for cancelling' });
    }

    const order = await WorkOrder.findByPk(req.params.id, { include: DETAIL_INCLUDE });

    if (!order) {
      return res.status(404).json({ code: 'work_order_not_found', message: 'Work order not found' });
    }

    // ตรวจสอบสิทธิ์ ต้องเป็นเจ้าของงานหรือหัวหน้างานหรือ admin
    const isOwner = order.technicianId === req.user.id;
    const isSupervisor = isSupervisorRole(req.user.role);

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

// ดึงใบงานที่เลยกำหนด
router.get('/status/overdue', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const orders = await WorkOrder.findAll({
      where: { status: 'overdue', isOverdue: true },
      include: [{ model: User, as: 'technician', attributes: TECHNICIAN_ATTRS }]
    });

    // overdueDays ในฐานข้อมูลเป็นค่า snapshot จาก cron ครั้งล่าสุด อาจไม่ตรงกับปัจจุบันแล้ว
    // จึงเรียงลำดับด้วยค่าที่คำนวณสดจาก computeOverdue แทนค่าที่เก็บไว้ ดู overdueCalc.js
    orders.sort((a, b) => computeOverdue(b).overdueDays - computeOverdue(a).overdueDays);

    res.json(orders);
  } catch (error) {
    logger.error(`Get overdue error: ${error.message}`);
    sendServerError(res);
  }
});

// ดึงใบงานที่ถูกยกเลิก สำหรับรายงานและประวัติ
// หัวหน้า/admin เห็นของทุกคน ส่วนช่างเทคนิคเห็นได้แค่ใบงานของตัวเอง
router.get('/status/cancelled', protect, async (req, res) => {
  try {
    const { month, year } = req.query;
    const where = { status: 'cancelled' };
    if (!isSupervisorRole(req.user.role)) {
      where.technicianId = req.user.id;
    }

    if (month && year) {
      const { start, end } = monthRangeUTC(year, month);
      where.cancelledAt = { [Op.gte]: start, [Op.lt]: end };
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
