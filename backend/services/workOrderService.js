const { Op, literal } = require('sequelize');
const WorkOrder = require('../models/WorkOrder');
const { sequelize } = require('../config/database');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { formatThaiDate } = require('../utils/dateFormat');
const { isRepairType, isInstallationType } = require('../config/workTypes');
const { SUPERVISOR_ROLES, isBlockedByRegion } = require('../config/roles');
const logger = require('../config/logger');

// ต่อจากเลขที่สูงสุดที่มีอยู่จริง ไม่ใช่นับจำนวนแถว เพราะถ้ามีใบงานตรงกลางถูกลบไปก่อนหน้า (เช่น ยกเลิกสัญญาแล้วลบใบงาน MA ที่เกิดจากสัญญานั้น)
// จำนวนแถวจะน้อยกว่าตัวเลขสูงสุดที่เคยใช้ไปแล้ว นับ+1 แบบเดิมจะได้เลขที่ซ้ำกับที่มีอยู่จริงเสมอ ไม่ใช่แค่ตอนชนกันพร้อมกัน
const generateSRNumber = async () => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `SR-${yearMonth}-`;
  // เรียงด้วยค่าตัวเลขจริง ไม่ใช่เรียงตาม string เพราะถ้าเลขท้ายเกิน 4 หลัก (10000 ขึ้นไป)
  // การเรียงแบบ string จะได้ "9999" มาก่อน "10000" เสมอ ทำให้เลขถัดไปคำนวณผิดค้างที่ 10000 ไม่รู้จบ
  const latest = await WorkOrder.findOne({
    // ข้ามเลขงานต่อแบบ SR-YYYYMM-0007-2 เพราะเลขท้ายแปลงเป็นตัวเลขไม่ได้
    where: { srNumber: { [Op.regexp]: `^${prefix}[0-9]+$` } },
    order: [[literal(`CAST(SUBSTRING("srNumber" FROM ${prefix.length + 1}) AS INTEGER)`), 'DESC']],
    attributes: ['srNumber']
  });
  const nextSeq = latest ? parseInt(latest.srNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

const isDuplicateSRNumber = (error) => error.name === 'SequelizeUniqueConstraintError'
  && (error.errors || []).some((e) => e.path === 'srNumber');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_SR_NUMBER_RETRIES = 10;

// วันที่ในข้อมูลแจ้งเตือนเก็บเป็น YYYY-MM-DD ล้วน ให้หน้าเว็บแสดงเป็น พ.ศ. หรือ ค.ศ. ตามภาษาเอง
// plannedDate เป็น UTC midnight อยู่แล้ว ตัดจาก ISO string ได้ตรงวันเสมอ ดู overdueCalc.js
const toDateOnly = (date) => new Date(date).toISOString().slice(0, 10);

// หัวหน้าช่างภาคใต้ไม่ได้รับแจ้งเตือนงานของช่างภาคอื่น เพราะจัดการงานนั้นไม่ได้อยู่แล้ว ดู isBlockedByRegion
// ดึง region ของช่างเองเลย เพราะแต่ละจุดที่เรียกโหลด technician มาไม่เหมือนกัน
const findSupervisorsToNotify = async (technicianId) => {
  const technician = await User.findByPk(technicianId, { attributes: ['region'] });
  const supervisors = await User.findAll({ where: { role: { [Op.in]: SUPERVISOR_ROLES } } });
  return supervisors.filter((sup) => !isBlockedByRegion(sup, { technicianId, technician }));
};

// สร้างใบงานและแจ้งเตือนหัวหน้างาน ใช้ร่วมกันทั้ง HTTP route และ LINE bot
// เพื่อให้เลข SR และการแจ้งเตือนขออนุมัติตรงกันเสมอ
const createWorkOrder = async ({ technician, customerName, customerLocation, workType,
  description, plannedDate, plannedStartTime, plannedEndTime }) => {
  // generateSRNumber นับแถวที่มีอยู่แล้ว +1 ถ้ามีคำขอสร้างใบงานพร้อมกันหลายอันในวินาทีเดียวกัน
  // จะนับได้เลขซ้ำกันได้ ตรงนี้เลย retry คำนวณเลขใหม่เฉพาะตอนชนกันจริงๆ (unique constraint ที่ DB เป็นคนเช็คให้)
  let srNumber;
  let workOrder;
  for (let attempt = 1; ; attempt++) {
    srNumber = await generateSRNumber();
    try {
      workOrder = await WorkOrder.create({
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
      break;
    } catch (error) {
      if (!isDuplicateSRNumber(error) || attempt >= MAX_SR_NUMBER_RETRIES) throw error;
      logger.warn(`SR number collision on ${srNumber}, retrying (attempt ${attempt})`);
      // สุ่มหน่วงเวลาสั้นๆ ก่อนลองใหม่ กันไม่ให้คำขอที่ชนกันรอบแรกไปนับเลขซ้ำกันอีกในรอบถัดไปพร้อมๆ กัน
      await sleep(20 + Math.random() * 80 * attempt);
    }
  }

  const supervisors = await findSupervisorsToNotify(technician.id);
  for (const sup of supervisors) {
    await Notification.create({
      recipientId: sup.id,
      type: 'approval_needed',
      title: 'รออนุมัติแผนงาน',
      message: `ช่าง ${technician.fullName} เสนอแผนงาน ${srNumber} - ${customerName}`,
      code: 'plan_submitted',
      data: { technician: technician.fullName, srNumber, customer: customerName },
      relatedWorkOrderId: workOrder.id
    });
  }

  logger.info(`Work order created: ${srNumber} by ${technician.username}`);
  return workOrder;
};

// ใช้ร่วมกันทั้ง HTTP route และ LINE bot เพื่อให้งานที่อนุมัติซ้ำหลังเลื่อนนัด
// เก็บประวัติการอนุมัติเดิมไว้ทั้งหมด ไม่เขียนทับ
const approveWorkOrder = async (order, { approvedById, approvedByName, approvalNote, actorLabel }) => {
  if (order.status !== 'pending_approval') {
    throw badRequest('Work order is not pending approval', 'not_pending_approval');
  }

  // เก็บชื่อผู้อนุมัติลงในรายการเลยเพราะ approvalHistory เป็น JSONB ธรรมดา ไม่ใช่ association ที่ join ได้
  // ทำให้ประวัติยังถูกต้องแม้ชื่อผู้ใช้จะเปลี่ยนภายหลัง
  const entry = { approvedById, approvedByName: approvedByName || null, approvalNote: approvalNote || null, approvedAt: new Date() };
  const approvalHistory = [...(order.approvalHistory || []), entry];

  // ใช้ update แบบมีเงื่อนไขแทนอ่านแล้วเซฟ กันกรณีกดอนุมัติซ้ำสองครั้งพร้อมกันจากเว็บกับ LINE
  // ใส่เงื่อนไขสถานะไว้ใน WHERE เลย จะได้มีแค่ครั้งแรกที่เขียนทับแถวที่ยัง pending_approval ได้จริง
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
    title: 'แผนงานได้รับการอนุมัติ',
    message: `งาน ${order.srNumber} (${order.customerName}) ได้รับการอนุมัติแล้ว`,
    code: 'plan_approved',
    data: { srNumber: order.srNumber, customer: order.customerName },
    relatedWorkOrderId: order.id
  });

  logger.info(`Work order approved: ${order.srNumber}${actorLabel ? ` by ${actorLabel}` : ''}`);
  return order;
};

const CANCELLABLE_STATUSES = ['draft', 'pending_approval', 'approved', 'overdue', 'in_progress'];

// code กับ data ให้ frontend เอาไปแปลข้อความตามภาษาที่ผู้ใช้เลือก ดู errorMessage ใน i18n.service.ts
// ส่วน message ภาษาอังกฤษเก็บไว้เป็นค่าสำรองสำหรับผู้ใช้ API ที่ไม่ผ่าน UI
function badRequest(message, code, data) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  err.data = data;
  return err;
}

// ใช้ร่วมกันทั้ง HTTP route และ LINE bot เพื่อให้ประวัติเลื่อนนัดกับการแจ้งเตือนตรงกันทั้งสองทาง
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

  const supervisors = await findSupervisorsToNotify(order.technicianId);
  for (const sup of supervisors) {
    await Notification.create({
      recipientId: sup.id,
      type: 'rescheduled',
      title: 'งานถูกเลื่อน',
      message: `งาน ${order.srNumber} เลื่อนจาก ${formatThaiDate(fromDate)} เป็น ${formatThaiDate(newDate)}\nเหตุผล: ${reason}`,
      code: 'job_rescheduled',
      data: { srNumber: order.srNumber, fromDate: toDateOnly(fromDate), toDate: toDateOnly(newDate), reason },
      relatedWorkOrderId: order.id
    });
  }

  logger.info(`Work order rescheduled: ${order.srNumber} to ${newDate}${actorLabel ? ` by ${actorLabel}` : ''}`);
  return order;
};

// order.technician ต้องถูกโหลดมาก่อนแล้วตอน isOwnerCancelling เป็นจริง
// เพราะข้อความแจ้งเตือนตอนช่างขอยกเลิกงานต้องใช้ชื่อช่างคนนั้น
const cancelWorkOrder = async (order, { cancelReason, cancelledById, isOwnerCancelling, isSupervisorCancelling, actorLabel }) => {
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw badRequest(`Cannot cancel a work order with status "${order.status}"`, 'cannot_cancel_status', { status: order.status });
  }

  order.status = 'cancelled';
  order.cancelledById = cancelledById;
  order.cancelledAt = new Date();
  order.cancelReason = cancelReason.trim();
  // งานที่ยกเลิกจะหลุดจากรายการที่ cron ใบงานเลยกำหนดตรวจ เหมือนงานที่เสร็จแล้ว
  // ถ้าไม่เคลียร์ค่าตรงนี้ งานที่ยกเลิกจะยังค้างแสดงว่าเลยกำหนดอยู่
  order.isOverdue = false;
  order.overdueDays = 0;
  await order.save();

  logger.info(`Work order cancelled: ${order.srNumber}${actorLabel ? ` by ${actorLabel}` : ''}. Reason: ${cancelReason}`);

  if (!isOwnerCancelling) {
    await Notification.create({
      recipientId: order.technicianId,
      type: 'cancelled',
      title: 'งานถูกยกเลิกโดยหัวหน้า',
      message: `งาน ${order.srNumber} (${order.customerName}) ถูกยกเลิก\nเหตุผล: ${cancelReason}`,
      code: 'cancelled_by_supervisor',
      data: { srNumber: order.srNumber, customer: order.customerName, reason: cancelReason },
      relatedWorkOrderId: order.id
    });
  } else if (!isSupervisorCancelling) {
    const supervisors = await findSupervisorsToNotify(order.technicianId);
    for (const sup of supervisors) {
      await Notification.create({
        recipientId: sup.id,
        type: 'cancelled',
        title: 'ช่างขอยกเลิกงาน',
        message: `${order.technician?.fullName || ''} ยกเลิกงาน ${order.srNumber} (${order.customerName})\nเหตุผล: ${cancelReason}`,
        code: 'cancelled_by_technician',
        data: { technician: order.technician?.fullName || '', srNumber: order.srNumber, customer: order.customerName, reason: cancelReason },
        relatedWorkOrderId: order.id
      });
    }
  }

  return order;
};

// workType เป็นซ่อมหรือติดตั้งเท่านั้นที่ต้องถามว่าทำเสร็จหรือไม่
// ประเภทอื่นถือว่าเสร็จทันทีที่บันทึกผลจริง
const logActualWork = async (order, { actualDate, actualStartTime, actualEndTime, actualLocation, actualDescription,
  repairCompleted, repairIncompleteReason, installationDelivered, recordedById, recordedByName, actorLabel }) => {
  if (!actualDescription) {
    throw badRequest('Actual description is required', 'actual_description_required');
  }

  const isRepair = isRepairType(order.workType);
  const isInstallation = isInstallationType(order.workType);

  if (isRepair) {
    if (typeof repairCompleted !== 'boolean') {
      throw badRequest('Please select the repair status', 'repair_status_required');
    }
    if (!repairCompleted && !repairIncompleteReason?.trim()) {
      throw badRequest('Please state why the repair is not finished', 'repair_incomplete_reason_required');
    }
  }

  const logEntry = { actualDate, actualStartTime, actualEndTime, actualLocation, actualDescription,
    recordedById, recordedByName: recordedByName || null, recordedAt: new Date(),
    // ทุกรายการต้องรอหัวหน้าหรือ admin กดตรวจรับ แม้คนบันทึกจะเป็นหัวหน้าเอง
    verifiedById: null, verifiedByName: null, verifiedAt: null, verifyResult: null };
  if (isRepair) {
    logEntry.repairCompleted = repairCompleted;
    logEntry.repairIncompleteReason = repairCompleted ? null : repairIncompleteReason.trim();
  }
  if (isInstallation) {
    logEntry.installationDelivered = !!installationDelivered;
  }

  order.actualLog = [...(order.actualLog || []), logEntry];
  order.changed('actualLog', true);

  // คัดลอกค่าล่าสุดไปไว้ที่ field actual ระดับบนด้วย
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
    // งานที่เสร็จแล้วจะหลุดจากรายการที่ cron ตรวจ เพราะ cron เช็คเฉพาะ approved in_progress pending_approval
    // ถ้าไม่เคลียร์ตรงนี้ งานที่เสร็จแล้วจะยังค้างแสดงว่าเลยกำหนดอยู่
    order.isOverdue = false;
    order.overdueDays = 0;
  }
  await order.save();

  logger.info(`Work order actual logged: ${order.srNumber}${actorLabel ? ` by ${actorLabel}` : ''} (status=${order.status})`);
  return order;
};

// หัวหน้าหรือ admin กดตรวจรับบันทึกงานจริงทีละรายการ อ้างอิงด้วยลำดับใน actualLog
// เพราะรายการถูกต่อท้ายอย่างเดียว ไม่มีการลบ ลำดับจึงไม่เปลี่ยน
const findUnverifiedLog = (order, logIndex) => {
  const entry = (order.actualLog || [])[logIndex];
  if (!entry) {
    throw badRequest('Actual log entry not found', 'actual_log_not_found');
  }
  if (entry.verifiedAt) {
    throw badRequest('This actual log entry is already verified', 'actual_log_already_verified');
  }
  return entry;
};

const markLogVerified = (order, logIndex, fields) => {
  order.actualLog = order.actualLog.map((log, i) => (i === logIndex ? { ...log, ...fields } : log));
  order.changed('actualLog', true);
};

const verifyActualLog = async (order, logIndex, { verifiedById, verifiedByName, actorLabel }) => {
  findUnverifiedLog(order, logIndex);
  markLogVerified(order, logIndex, {
    verifiedById, verifiedByName: verifiedByName || null, verifiedAt: new Date(), verifyResult: 'passed'
  });
  await order.save();

  logger.info(`Actual log verified: ${order.srNumber} #${logIndex + 1}${actorLabel ? ` by ${actorLabel}` : ''}`);
  return order;
};

// เลขงานต่อใช้เลข SR ต้นทางแล้วเติมลำดับต่อท้าย เริ่มที่ 2 เช่น SR-202610-0007-2
// ถ้างานต่อไม่ผ่านอีก ก็ยังนับต่อจากเลขต้นทางเดิม ได้ SR-202610-0007-3
const generateFollowUpSRNumber = async (srNumber) => {
  const baseSrNumber = srNumber.replace(/^(SR-\d{6}-\d+)-\d+$/, '$1');
  const followUps = await WorkOrder.findAll({
    where: { srNumber: { [Op.regexp]: `^${baseSrNumber}-[0-9]+$` } },
    attributes: ['srNumber']
  });
  const maxSeq = followUps.reduce((max, o) => Math.max(max, parseInt(o.srNumber.slice(baseSrNumber.length + 1), 10)), 1);
  return `${baseSrNumber}-${maxSeq + 1}`;
};

// ตรวจรับไม่ผ่าน สร้างงานใหม่ที่อนุมัติแล้วให้ช่างคนเดิมไปทำต่อ และปิดงานเดิมเป็นเสร็จสิ้น
// ทำใน transaction เดียว กันกรณีสร้างงานใหม่ได้แต่บันทึกงานเดิมไม่สำเร็จ
const rejectActualLog = async (order, logIndex, { plannedDate, plannedStartTime, plannedEndTime, description, verifiedById, verifiedByName, actorLabel }) => {
  findUnverifiedLog(order, logIndex);
  if (!plannedDate || !description?.trim()) {
    throw badRequest('Please provide the new date and description', 'reject_fields_required');
  }

  const now = new Date();
  let followUp;
  for (let attempt = 1; ; attempt++) {
    const srNumber = await generateFollowUpSRNumber(order.srNumber);
    try {
      followUp = await sequelize.transaction(async (transaction) => {
        const created = await WorkOrder.create({
          srNumber,
          technicianId: order.technicianId,
          customerName: order.customerName,
          customerLocation: order.customerLocation,
          workType: order.workType,
          description: description.trim(),
          plannedDate,
          // ไม่ได้ส่งเวลามา ให้ใช้เวลาเดิมของงานต้นทาง
          plannedStartTime: plannedStartTime ?? order.plannedStartTime,
          plannedEndTime: plannedEndTime ?? order.plannedEndTime,
          status: 'approved',
          approvedById: verifiedById,
          approvedAt: now,
          approvalHistory: [{ approvedById: verifiedById, approvedByName: verifiedByName || null, approvalNote: null, approvedAt: now }],
          parentWorkOrderId: order.id,
          parentSrNumber: order.srNumber
        }, { transaction });

        markLogVerified(order, logIndex, {
          verifiedById, verifiedByName: verifiedByName || null, verifiedAt: now, verifyResult: 'rejected',
          followUpWorkOrderId: created.id, followUpSrNumber: created.srNumber
        });
        order.status = 'completed';
        order.isOverdue = false;
        order.overdueDays = 0;
        await order.save({ transaction });
        return created;
      });
      break;
    } catch (error) {
      if (!isDuplicateSRNumber(error) || attempt >= MAX_SR_NUMBER_RETRIES) throw error;
      // transaction ถูกยกเลิกแล้ว ต้องโหลดงานเดิมใหม่ก่อนลองอีกรอบ ค่าที่แก้ในหน่วยความจำจะได้ไม่ค้าง
      await order.reload();
      await sleep(20 + Math.random() * 80 * attempt);
    }
  }

  await Notification.create({
    recipientId: order.technicianId,
    type: 'approval_needed',
    title: 'แผนงานได้รับการอนุมัติ',
    message: `งาน ${followUp.srNumber} (${followUp.customerName}) ได้รับการอนุมัติแล้ว`,
    code: 'plan_approved',
    data: { srNumber: followUp.srNumber, customer: followUp.customerName },
    relatedWorkOrderId: followUp.id
  });

  logger.info(`Actual log rejected: ${order.srNumber} #${logIndex + 1}, follow-up ${followUp.srNumber}${actorLabel ? ` by ${actorLabel}` : ''}`);
  return { order, followUp };
};

// เพิ่ม URL รูปใหม่ต่อท้ายแทนการเขียนทับ เพื่อให้รูปจากหลายครั้งที่เข้างาน เช่น ก่อนและหลังเลื่อนนัด ยังอยู่ครบ
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

module.exports = { generateSRNumber, createWorkOrder, approveWorkOrder, rescheduleWorkOrder, cancelWorkOrder, logActualWork, verifyActualLog, rejectActualLog, addPhotos, removePhoto, findSupervisorsToNotify, CANCELLABLE_STATUSES };
