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
    throw badRequest('Work order is not pending approval', 'not_pending_approval');
  }

  // Snapshot the approver's name onto the entry itself — approvalHistory is a
  // plain JSONB array, not a real association, so there's nothing to join
  // against later (and this also keeps history accurate if the name changes).
  const entry = { approvedById, approvedByName: approvedByName || null, approvalNote: approvalNote || null, approvedAt: new Date() };
  const approvalHistory = [...(order.approvalHistory || []), entry];

  // Conditional update instead of read-then-save: two "approve" requests for
  // the same order (a double-click, or a web click racing a LINE "อนุมัติ")
  // both pass the status check above before either write lands if this were
  // a plain order.save() — collapsing the check into the WHERE clause means
  // only the first write can actually match a still-pending_approval row.
  const [affectedCount] = await WorkOrder.update({
    status: 'approved',
    approvedById: entry.approvedById,
    approvedAt: entry.approvedAt,
    approvalNote: entry.approvalNote,
    approvalHistory
  }, {
    where: { id: order.id, status: 'pending_approval' }
  });

  if (affectedCount === 0) {
    throw badRequest('Work order is not pending approval', 'not_pending_approval');
  }

  await order.reload();

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

// `code`/`data` let the frontend translate the message into whichever UI
// language the user has selected (see i18n.service.ts's errorMessage()); the
// English `message` stays as a fallback for non-UI API consumers.
function badRequest(message, code, data) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  err.data = data;
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
    throw badRequest(`Cannot cancel a work order with status "${order.status}"`, 'cannot_cancel_status', { status: order.status });
  }

  order.status = 'cancelled';
  order.cancelledById = cancelledById;
  order.cancelledAt = new Date();
  order.cancelReason = cancelReason.trim();
  // Cancelled orders drop out of the overdue cron's candidate query same as
  // completed ones do — nothing else would clear these, leaving a cancelled
  // job stuck showing "overdue" next to its cancelled banner.
  order.isOverdue = false;
  order.overdueDays = 0;
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
    throw badRequest('Actual description is required', 'actual_description_required');
  }

  const isRepair = order.workType === 'ซ่อม';
  const isInstallation = order.workType === 'ติดตั้ง';

  if (isRepair) {
    if (typeof repairCompleted !== 'boolean') {
      throw badRequest('Please select the repair status', 'repair_status_required');
    }
    if (!repairCompleted && !repairIncompleteReason?.trim()) {
      throw badRequest('Please state why the repair is not finished', 'repair_incomplete_reason_required');
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
  if (order.status === 'completed') {
    // Completed orders drop out of the overdue cron's candidate query (it only
    // rechecks approved/in_progress/pending_approval), so nothing else would
    // ever clear these flags — leaving a finished job stuck showing "overdue".
    order.isOverdue = false;
    order.overdueDays = 0;
  }
  await order.save();

  logger.info(`Work order actual logged: ${order.srNumber}${actorLabel ? ` by ${actorLabel}` : ''} (status=${order.status})`);
  return order;
};

// Appends newly uploaded photo URLs rather than overwriting, so photos from
// separate visits (e.g. before/after a reschedule) all stay on the order.
const addPhotos = async (order, photoUrls, actorLabel) => {
  order.photos = [...(order.photos || []), ...photoUrls];
  order.changed('photos', true);
  await order.save();

  logger.info(`Photos added: ${order.srNumber}${actorLabel ? ` by ${actorLabel}` : ''} (+${photoUrls.length})`);
  return order;
};

const removePhoto = async (order, photoUrl, actorLabel) => {
  const photos = order.photos || [];
  if (!photos.includes(photoUrl)) {
    throw badRequest('Photo not found on this work order', 'photo_not_found_on_order');
  }

  order.photos = photos.filter(p => p !== photoUrl);
  order.changed('photos', true);
  await order.save();

  logger.info(`Photo removed: ${order.srNumber}${actorLabel ? ` by ${actorLabel}` : ''}`);
  return order;
};

module.exports = { generateSRNumber, createWorkOrder, approveWorkOrder, rescheduleWorkOrder, cancelWorkOrder, logActualWork, addPhotos, removePhoto, CANCELLABLE_STATUSES };
