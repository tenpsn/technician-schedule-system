const { Op } = require('sequelize');
const WorkOrder = require('../models/WorkOrder');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../config/logger');

const generateSRNumber = async () => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = await WorkOrder.count({
    where: { srNumber: { [Op.like]: `SR-${yearMonth}%` } }
  });
  return `SR-${yearMonth}-${String(count + 1).padStart(4, '0')}`;
};

// Creates a work order and notifies supervisors. Shared by the HTTP route
// and the LINE bot so SR numbering and the approval notification stay in sync.
const createWorkOrder = async ({ technician, customerName, customerLocation, workType,
  description, plannedDate, plannedStartTime, plannedEndTime }) => {
  const srNumber = await generateSRNumber();

  const workOrder = await WorkOrder.create({
    srNumber,
    technicianId: technician.id,
    customerName,
    customerLocation,
    workType,
    description,
    plannedDate,
    plannedStartTime,
    plannedEndTime,
    status: 'pending_approval'
  });

  const supervisors = await User.findAll({ where: { role: { [Op.in]: ['supervisor', 'admin'] } } });
  for (const sup of supervisors) {
    await Notification.create({
      recipientId: sup.id,
      type: 'approval_needed',
      title: '📋 รออนุมัติแผนงาน',
      message: `ช่าง ${technician.fullName} เสนอแผนงาน ${srNumber} - ${customerName}`,
      relatedWorkOrderId: workOrder.id
    });
  }

  logger.info(`Work order created: ${srNumber} by ${technician.username}`);
  return workOrder;
};

// Shared by the HTTP route and the LINE bot so a job re-approved after a
// reschedule keeps every past approval on record instead of overwriting it.
const approveWorkOrder = async (order, { approvedById, approvedByName, approvalNote, actorLabel }) => {
  if (order.status !== 'pending_approval') {
    throw badRequest('Work order is not pending approval');
  }

  // Snapshot the approver's name onto the entry itself — approvalHistory is a
  // plain JSONB array, not a real association, so there's nothing to join
  // against later (and this also keeps history accurate if the name changes).
  const entry = { approvedById, approvedByName: approvedByName || null, approvalNote: approvalNote || null, approvedAt: new Date() };
  order.approvalHistory = [...(order.approvalHistory || []), entry];
  order.changed('approvalHistory', true);

  order.status = 'approved';
  order.approvedById = entry.approvedById;
  order.approvedAt = entry.approvedAt;
  order.approvalNote = entry.approvalNote;
  await order.save();

  await Notification.create({
    recipientId: order.technicianId,
    type: 'approval_needed',
    title: '✅ แผนงานได้รับการอนุมัติ',
    message: `งาน ${order.srNumber} (${order.customerName}) ได้รับการอนุมัติแล้ว`,
    relatedWorkOrderId: order.id
  });

  logger.info(`Work order approved: ${order.srNumber}${actorLabel ? ` by ${actorLabel}` : ''}`);
  return order;
};

const CANCELLABLE_STATUSES = ['draft', 'pending_approval', 'approved', 'overdue', 'in_progress'];

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

// Shared by the HTTP route and the LINE bot so reschedule history / approval
// notifications stay in sync between the two entry points.
const rescheduleWorkOrder = async (order, { newDate, reason, changedById, changedByName, actorLabel }) => {
  const fromDate = order.plannedDate;
  order.rescheduleHistory = [...(order.rescheduleHistory || []), {
    fromDate,
    toDate: new Date(newDate),
    reason,
    changedBy: changedById,
    changedByName: changedByName || null,
    changedAt: new Date()
  }];
  order.changed('rescheduleHistory', true);

  order.plannedDate = new Date(newDate);
  order.status = 'pending_approval';
  order.isOverdue = false;
  order.overdueDays = 0;
  await order.save();

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

  logger.info(`Work order rescheduled: ${order.srNumber} to ${newDate}${actorLabel ? ` by ${actorLabel}` : ''}`);
  return order;
};

// order.technician must already be loaded (via association include) when
// isOwnerCancelling is true, since the "technician asked to cancel" notification
// text uses their name.
const cancelWorkOrder = async (order, { cancelReason, cancelledById, isOwnerCancelling, isSupervisorCancelling, actorLabel }) => {
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw badRequest(`ไม่สามารถยกเลิกงานที่มีสถานะ "${order.status}" ได้`);
  }

  order.status = 'cancelled';
  order.cancelledById = cancelledById;
  order.cancelledAt = new Date();
  order.cancelReason = cancelReason.trim();
  await order.save();

  logger.info(`Work order cancelled: ${order.srNumber}${actorLabel ? ` by ${actorLabel}` : ''}. Reason: ${cancelReason}`);

  if (!isOwnerCancelling) {
    await Notification.create({
      recipientId: order.technicianId,
      type: 'cancelled',
      title: '🚫 งานถูกยกเลิกโดยหัวหน้า',
      message: `งาน ${order.srNumber} (${order.customerName}) ถูกยกเลิก\nเหตุผล: ${cancelReason}`,
      relatedWorkOrderId: order.id
    });
  } else if (!isSupervisorCancelling) {
    const supervisors = await User.findAll({ where: { role: { [Op.in]: ['supervisor', 'admin'] } } });
    for (const sup of supervisors) {
      await Notification.create({
        recipientId: sup.id,
        type: 'cancelled',
        title: '🚫 ช่างขอยกเลิกงาน',
        message: `${order.technician?.fullName || ''} ยกเลิกงาน ${order.srNumber} (${order.customerName})\nเหตุผล: ${cancelReason}`,
        relatedWorkOrderId: order.id
      });
    }
  }

  return order;
};

// workType === 'ซ่อม'/'ติดตั้ง' only get their finished-or-not question; every
// other type is considered done as soon as actual work is logged.
const logActualWork = async (order, { actualDate, actualStartTime, actualEndTime, actualLocation, actualDescription,
  repairCompleted, repairIncompleteReason, installationDelivered, recordedById, actorLabel }) => {
  if (!actualDescription) {
    throw badRequest('Actual description is required');
  }

  const isRepair = order.workType === 'ซ่อม';
  const isInstallation = order.workType === 'ติดตั้ง';

  if (isRepair) {
    if (typeof repairCompleted !== 'boolean') {
      throw badRequest('กรุณาเลือกสถานะการซ่อม');
    }
    if (!repairCompleted && !repairIncompleteReason?.trim()) {
      throw badRequest('กรุณาระบุสาเหตุที่ยังซ่อมไม่เสร็จ');
    }
  }

  const logEntry = { actualDate, actualStartTime, actualEndTime, actualLocation, actualDescription,
    recordedById, recordedAt: new Date() };
  if (isRepair) {
    logEntry.repairCompleted = repairCompleted;
    logEntry.repairIncompleteReason = repairCompleted ? null : repairIncompleteReason.trim();
  }
  if (isInstallation) {
    logEntry.installationDelivered = !!installationDelivered;
  }

  order.actualLog = [...(order.actualLog || []), logEntry];
  order.changed('actualLog', true);

  // Mirror the latest entry onto the top-level actual* fields
  order.actualDate = actualDate;
  order.actualStartTime = actualStartTime;
  order.actualEndTime = actualEndTime;
  order.actualLocation = actualLocation;
  order.actualDescription = actualDescription;
  if (isRepair) {
    order.repairCompleted = logEntry.repairCompleted;
    order.repairIncompleteReason = logEntry.repairIncompleteReason;
  }
  if (isInstallation) {
    order.installationDelivered = logEntry.installationDelivered;
  }

  const isUnfinished = (isRepair && !repairCompleted) || (isInstallation && !logEntry.installationDelivered);
  order.status = isUnfinished ? 'approved' : 'completed';
  await order.save();

  logger.info(`Work order actual logged: ${order.srNumber}${actorLabel ? ` by ${actorLabel}` : ''} (status=${order.status})`);
  return order;
};

module.exports = { generateSRNumber, createWorkOrder, approveWorkOrder, rescheduleWorkOrder, cancelWorkOrder, logActualWork, CANCELLABLE_STATUSES };
