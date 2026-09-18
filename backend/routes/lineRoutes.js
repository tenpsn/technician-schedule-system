const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const WorkOrder = require('../models/WorkOrder');
const { createWorkOrder, approveWorkOrder, rescheduleWorkOrder, cancelWorkOrder, logActualWork, addPhotos, CANCELLABLE_STATUSES } = require('../services/workOrderService');
const { saveCompressedPhoto } = require('../middleware/upload');
const { isAddJobMessage, parseAddJobMessage, parseThaiDate, parseTimeRange } = require('../utils/lineJobParser');
const lineSession = require('../utils/lineSession');
const loginAttempts = require('../utils/loginAttempts');
const { formatThaiDate } = require('../utils/dateFormat');
const { isSupervisorRole } = require('../config/roles');
const { WORK_TYPES, OTHER_TYPE, isRepairType, isInstallationType } = require('../config/workTypes');
const logger = require('../config/logger');

const router = express.Router();

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

const HELP_TEXT =
`พิมพ์ "เพิ่มงาน" แล้วบอทจะถามข้อมูลทีละอย่าง
หรือพิมพ์ข้อมูลทั้งหมดในข้อความเดียวก็ได้

เพิ่มงาน
ลูกค้า: ชื่อลูกค้า (ถ้าตรงกับชื่อ รพ. ในระบบ จะเติมสถานที่ให้อัตโนมัติ)
สถานที่: สถานที่ปฏิบัติงาน
ประเภทงาน: MA / ติดตั้ง / ซ่อม
วันที่: 20/09/2026
เวลา: 09:00-12:00
รายละเอียด: รายละเอียดงาน (ไม่บังคับ)

พิมพ์ "เลื่อนงาน", "ยกเลิกงาน", "บันทึกงานจริง" หรือ "ส่งรูป" แล้วบอทจะถามเลขที่งานและข้อมูลที่ต้องใช้ทีละขั้น`;

const LOGIN_SWITCH_TEXT =
`ต้องการเปลี่ยนบัญชีที่เชื่อมไว้ พิมพ์ "login" แล้วบอทจะถามทีละขั้น
หรือพิมพ์บรรทัดเดียว: login ชื่อผู้ใช้ รหัสผ่าน`;

const ADD_JOB_PROMPTS = {
  customerName: 'พิมพ์ชื่อลูกค้า/โรงพยาบาล',
  customerLocation: 'ไม่พบชื่อนี้ในฐานข้อมูล รพ. กรุณาพิมพ์สถานที่ปฏิบัติงาน',
  workType: `ประเภทงาน\n\n${WORK_TYPES.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`,
  workTypeOther: 'อื่นๆ โปรดระบุ',
  plannedDate: 'วันที่ปฏิบัติงาน เช่น 15/09/2026',
  plannedTime: 'เวลา (HH:MM-HH:MM) เช่น 09:00-12:00',
  description: 'รายละเอียดงาน (ถ้าไม่มีพิมพ์ - หรือ ข้าม)'
};

// ใช้หยุดขั้นตอนทีละขั้นที่กำลังทำอยู่ จงใจไม่ใช้คำว่ายกเลิกเพราะซ้ำกับคำสั่งยกเลิกงานอีกตัว กันสับสน
const ABORT_KEYWORDS = ['หยุด'];
const SKIP_KEYWORDS = ['ข้าม', 'ไม่มี', 'ไม่ระบุ', '-', 'skip'];
const isSkip = (value) => SKIP_KEYWORDS.includes(value.toLowerCase());

const RESCHEDULABLE_STATUSES = ['approved', 'pending_approval'];

const RESCHEDULE_PROMPTS = {
  srNumber: 'พิมพ์เลขที่งานที่ต้องการเลื่อน เช่น SR-202609-0034',
  newDate: 'วันที่ใหม่ (วว/ดด/ปปปป) เช่น 20/09/2026',
  reason: 'เหตุผลที่เลื่อน'
};

const CANCEL_JOB_PROMPTS = {
  srNumber: 'พิมพ์เลขที่งานที่ต้องการยกเลิก เช่น SR-202609-0034',
  reason: 'เหตุผลที่ยกเลิก'
};

const ACTUAL_PROMPTS = {
  srNumber: 'พิมพ์เลขที่งานที่ต้องการบันทึกผลจริง เช่น SR-202609-0034',
  actualDate: 'วันที่ทำงานจริง (วว/ดด/ปปปป) เช่น 20/09/2026',
  actualTime: 'เวลาที่ทำงานจริง (HH:MM-HH:MM) เช่น 09:00-12:00',
  actualLocation: 'สถานที่จริง',
  actualDescription: 'รายละเอียดงานที่ทำได้จริง',
  repairCompleted: 'งานซ่อมนี้เสร็จหรือยัง?\n1. เสร็จแล้ว\n2. ยังไม่เสร็จ',
  repairIncompleteReason: 'สาเหตุที่ยังไม่เสร็จ',
  installationDelivered: 'ส่งมอบเครื่องให้ลูกค้าแล้วหรือยัง?\n1. ส่งมอบแล้ว\n2. ยังไม่ส่งมอบ'
};

const APPROVE_HELP_TEXT =
`สำหรับหัวหน้าช่าง/แอดมิน พิมพ์เพื่ออนุมัติงาน

อนุมัติ เลขที่งาน
หมายเหตุ: หมายเหตุ (ไม่บังคับ)

เช่น: อนุมัติ SR-202609-0034`;

const LINK_HELP_TEXT =
  'ยังไม่ได้เชื่อมบัญชี พิมพ์ "login" แล้วบอทจะถามทีละขั้น\nหรือพิมพ์บรรทัดเดียว: login ชื่อผู้ใช้ รหัสผ่าน';

const LOGIN_PROMPTS = {
  username: 'พิมพ์ชื่อผู้ใช้',
  password: 'พิมพ์รหัสผ่าน'
};

const APPROVE_KEYWORD = /^อนุมัติ\s+(\S+)/;
const isApproveMessage = (text) => APPROVE_KEYWORD.test(text.trim());

const verifySignature = (req) => {
  const signature = req.headers['x-line-signature'];
  if (!signature || !req.rawBody) return false;
  const expected = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET)
    .update(req.rawBody)
    .digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const REPLY_MAX_ATTEMPTS = 3;

// DNS ของ api.line.me ในเน็ตเวิร์กออฟฟิศนี้บางครั้งหลุดแล้วกลับมาใช้ได้เอง
// retry รอบเดียวทันทีไม่พอ ต้องรอสักครู่แล้วลองใหม่หลายรอบ
const replyText = async (replyToken, text, attempt = 1) => {
  let res;
  try {
    res = await fetch(LINE_REPLY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
      // ถ้าไม่ตั้ง timeout นี้ DNS ที่ค้างจะรอ undici ประมาณ 10 วินาทีกว่าจะยอมแพ้เอง
      // ตั้งให้ fail เร็วขึ้นเพื่อให้ retry มีเวลาช่วยจริง
      signal: AbortSignal.timeout(5000)
    });
  } catch (error) {
    if (attempt < REPLY_MAX_ATTEMPTS) {
      logger.warn(`LINE reply network error (attempt ${attempt}/${REPLY_MAX_ATTEMPTS}), retrying: ${error.message}`);
      await sleep(800 * attempt);
      return replyText(replyToken, text, attempt + 1);
    }
    logger.error(`LINE reply failed after ${REPLY_MAX_ATTEMPTS} attempts: ${error.message}`);
    return;
  }
  if (!res.ok) {
    logger.error(`LINE reply failed: ${res.status} ${await res.text()}`);
  }
};

const finishLogin = async (user, lineUserId, replyToken) => {
  // lineUserId เป็นค่า unique ถ้าจะเปลี่ยนบัญชีที่ผูกไว้ต้องปลดจากบัญชีเดิมก่อน
  // ไม่งั้น save ด้านล่างจะพังเพราะ unique constraint
  await User.update({ lineUserId: null }, { where: { lineUserId, id: { [Op.ne]: user.id } } });

  user.lineUserId = lineUserId;
  await user.save();
  logger.info(`LINE account linked: ${user.username}`);
  const roleHelp = isSupervisorRole(user.role) ? `\n\n${APPROVE_HELP_TEXT}` : '';
  return replyText(replyToken,
    `เชื่อมบัญชีสำเร็จ ✅ สวัสดีคุณ ${user.fullName}\n\n${HELP_TEXT}${roleHelp}\n\n${LOGIN_SWITCH_TEXT}`);
};

// จงใจใช้ข้อความเดียวกันไม่ว่าจะเป็นชื่อผู้ใช้ผิดหรือรหัสผ่านผิด กันคนร้ายไล่เดาว่าชื่อไหนมีจริง
// มีแค่คำเตือนใกล้ถูกล็อกที่จะต่างออกไป
const buildLoginFailMessage = (remainingAttempts) => {
  const base = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
  if (remainingAttempts > 0 && remainingAttempts <= 2) {
    return `${base} (เหลืออีก ${remainingAttempts} ครั้งก่อนถูกล็อกชั่วคราว)`;
  }
  return base;
};

// รูปแบบพิมพ์รวดเดียว login ตามด้วยชื่อผู้ใช้และรหัสผ่านในบรรทัดเดียว
const handleLinkAccount = async (text, lineUserId, replyToken) => {
  const lockedMinutes = loginAttempts.checkLocked(lineUserId);
  if (lockedMinutes) {
    return replyText(replyToken, `ลองรหัสผ่านผิดหลายครั้งเกินไป กรุณาลองใหม่อีกครั้งใน ${lockedMinutes} นาที`);
  }

  const [, username, password] = text.split(/\s+/);
  if (!username || !password) {
    return replyText(replyToken, 'รูปแบบไม่ถูกต้อง พิมพ์: login ชื่อผู้ใช้ รหัสผ่าน');
  }

  const user = await User.findOne({ where: { username } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.password))) {
    const remaining = loginAttempts.recordFailure(lineUserId);
    return replyText(replyToken, buildLoginFailMessage(remaining));
  }

  loginAttempts.recordSuccess(lineUserId);
  return finishLogin(user, lineUserId, replyToken);
};

// รูปแบบทีละขั้น พิมพ์ login เฉยๆ จะเริ่มถามชื่อผู้ใช้แล้วตามด้วยรหัสผ่าน
const startLoginSession = (lineUserId, replyToken) => {
  const lockedMinutes = loginAttempts.checkLocked(lineUserId);
  if (lockedMinutes) {
    return replyText(replyToken, `ลองรหัสผ่านผิดหลายครั้งเกินไป กรุณาลองใหม่อีกครั้งใน ${lockedMinutes} นาที`);
  }
  lineSession.set(lineUserId, { flow: 'login', step: 'username', data: {} });
  return replyText(replyToken,
    `เข้าสู่ระบบ 🔐 (พิมพ์ "หยุด" เพื่อหยุดได้ทุกเมื่อ)\n\n${LOGIN_PROMPTS.username}`);
};

const handleLoginStep = async (text, lineUserId, replyToken, session) => {
  const value = text.trim();

  if (ABORT_KEYWORDS.includes(value)) {
    lineSession.clear(lineUserId);
    return replyText(replyToken, 'ยกเลิกการเข้าสู่ระบบแล้ว');
  }

  const { step, data } = session;

  if (step === 'username') {
    data.username = value;
    lineSession.set(lineUserId, { flow: 'login', step: 'password', data });
    return replyText(replyToken, LOGIN_PROMPTS.password);
  }

  // ขั้นตอนรหัสผ่าน
  lineSession.clear(lineUserId);
  const lockedMinutes = loginAttempts.checkLocked(lineUserId);
  if (lockedMinutes) {
    return replyText(replyToken, `ลองรหัสผ่านผิดหลายครั้งเกินไป กรุณาลองใหม่อีกครั้งใน ${lockedMinutes} นาที`);
  }
  const user = await User.findOne({ where: { username: data.username } });
  if (!user || !user.active || !(await bcrypt.compare(value, user.password))) {
    const remaining = loginAttempts.recordFailure(lineUserId);
    return replyText(replyToken, `${buildLoginFailMessage(remaining)} พิมพ์ "login" เพื่อลองใหม่`);
  }

  loginAttempts.recordSuccess(lineUserId);
  return finishLogin(user, lineUserId, replyToken);
};

// รายชื่อโรงพยาบาลหลักเก็บแค่ชื่อย่อกับที่อยู่ เอาชื่อลูกค้าที่พิมพ์มาเทียบเพื่อเติมสถานที่ให้อัตโนมัติ
// ต้อง escape ตัวอักษร % และ _ ก่อนเพราะ ILIKE ตีความเป็น wildcard ถึงแม้ Sequelize จะกัน SQL injection แล้วก็ตาม
const escapeLikePattern = (str) => str.replace(/[\\%_]/g, (c) => `\\${c}`);

const findHospitalMatch = async (customerName) => {
  const cleaned = escapeLikePattern(customerName.replace(/^รพ\.?\s*/, '').trim());

  const exact = await Hospital.findOne({ where: { name: { [Op.iLike]: cleaned } } });
  if (exact) return exact;

  const partial = await Hospital.findAll({
    where: { name: { [Op.iLike]: `%${cleaned}%` } },
    limit: 2
  });
  return partial.length === 1 ? partial[0] : null;
};

const finishAddJob = async (technician, data, replyToken) => {
  let workOrder;
  try {
    workOrder = await createWorkOrder({ technician, ...data });
  } catch (error) {
    return replyText(replyToken, error.message);
  }
  return replyText(replyToken,
    `เพิ่มงานสำเร็จ ✅\nเลขที่: ${workOrder.srNumber}\nลูกค้า: ${workOrder.customerName}\n` +
    `วันที่: ${formatThaiDate(data.plannedDate)}\n\nสถานะ: รอหัวหน้าอนุมัติ`);
};

// รูปแบบพิมพ์รวดเดียว กรอกทุกฟิลด์พร้อมป้ายกำกับในข้อความเดียว
const handleAddJob = async (text, technician, replyToken) => {
  const result = parseAddJobMessage(text);

  if (!result.ok) {
    if (result.missing) {
      return replyText(replyToken, `กรอกข้อมูลไม่ครบ ขาด: ${result.missing.join(', ')}\n\n${HELP_TEXT}`);
    }
    if (result.invalidDate) {
      return replyText(replyToken, 'รูปแบบวันที่ไม่ถูกต้อง ใช้ วว/ดด/ปปปป เช่น 20/09/2026');
    }
    return replyText(replyToken, 'รูปแบบเวลาไม่ถูกต้อง ใช้ HH:MM-HH:MM เช่น 09:00-12:00');
  }

  if (!result.data.customerLocation) {
    const hospital = await findHospitalMatch(result.data.customerName);
    if (!hospital) {
      return replyText(replyToken,
        `ไม่พบ "${result.data.customerName}" ในฐานข้อมูลโรงพยาบาล กรุณาระบุ "สถานที่:" เพิ่มด้วย`);
    }
    result.data.customerLocation = hospital.address;
  }

  return finishAddJob(technician, result.data, replyToken);
};

// รูปแบบทีละขั้น พิมพ์เพิ่มงานเฉยๆ จะเริ่ม session แล้วถามทีละฟิลด์
const startAddJobSession = (lineUserId, replyToken) => {
  lineSession.set(lineUserId, { flow: 'addJob', step: 'customerName', data: {} });
  return replyText(replyToken,
    `เริ่มเพิ่มงานใหม่ ✏️ (พิมพ์ "หยุด" เพื่อหยุดได้ทุกเมื่อ)\n\n${ADD_JOB_PROMPTS.customerName}`);
};

const handleAddJobStep = async (text, technician, lineUserId, replyToken, session) => {
  const value = text.trim();

  if (ABORT_KEYWORDS.includes(value)) {
    lineSession.clear(lineUserId);
    return replyText(replyToken, 'ยกเลิกการเพิ่มงานแล้ว');
  }

  const { step, data } = session;

  if (step === 'customerName') {
    data.customerName = value;
    const hospital = await findHospitalMatch(value);
    if (hospital) {
      data.customerLocation = hospital.address;
      lineSession.set(lineUserId, { flow: 'addJob', step: 'workType', data });
      return replyText(replyToken, `เติมสถานที่ให้อัตโนมัติ: ${data.customerLocation}\n\n${ADD_JOB_PROMPTS.workType}`);
    }
    lineSession.set(lineUserId, { flow: 'addJob', step: 'customerLocation', data });
    return replyText(replyToken, ADD_JOB_PROMPTS.customerLocation);
  }

  if (step === 'customerLocation') {
    data.customerLocation = value;
    lineSession.set(lineUserId, { flow: 'addJob', step: 'workType', data });
    return replyText(replyToken, ADD_JOB_PROMPTS.workType);
  }

  if (step === 'workType') {
    const optionIndex = WORK_TYPES.findIndex(
      (opt, i) => value === String(i + 1) || value.toLowerCase() === opt.toLowerCase()
    );
    if (optionIndex === -1) {
      return replyText(replyToken, `เลือกไม่ถูกต้อง กรุณาพิมพ์ตัวเลข 1-${WORK_TYPES.length}\n\n${ADD_JOB_PROMPTS.workType}`);
    }
    if (WORK_TYPES[optionIndex] === OTHER_TYPE) {
      lineSession.set(lineUserId, { flow: 'addJob', step: 'workTypeOther', data });
      return replyText(replyToken, ADD_JOB_PROMPTS.workTypeOther);
    }
    data.workType = WORK_TYPES[optionIndex];
    lineSession.set(lineUserId, { flow: 'addJob', step: 'plannedDate', data });
    return replyText(replyToken, ADD_JOB_PROMPTS.plannedDate);
  }

  if (step === 'workTypeOther') {
    data.workType = OTHER_TYPE;
    const note = `ประเภทงาน: ${value}`;
    data.description = data.description ? `${note}\n${data.description}` : note;
    lineSession.set(lineUserId, { flow: 'addJob', step: 'plannedDate', data });
    return replyText(replyToken, ADD_JOB_PROMPTS.plannedDate);
  }

  if (step === 'plannedDate') {
    const date = parseThaiDate(value);
    if (!date) {
      return replyText(replyToken, 'รูปแบบวันที่ไม่ถูกต้อง ลองใหม่ (วว/ดด/ปปปป) เช่น 20/09/2026');
    }
    data.plannedDate = date;
    lineSession.set(lineUserId, { flow: 'addJob', step: 'plannedTime', data });
    return replyText(replyToken, ADD_JOB_PROMPTS.plannedTime);
  }

  if (step === 'plannedTime') {
    // ฟิลด์นี้บังคับกรอก ไม่รับข้ามหรือไม่มี เหมือนฟิลด์อื่นที่เป็นตัวเลือก
    const range = parseTimeRange(value);
    if (!range) {
      return replyText(replyToken, 'รูปแบบเวลาไม่ถูกต้อง กรุณาระบุเวลา (HH:MM-HH:MM) เช่น 09:00-12:00');
    }
    data.plannedStartTime = range.start;
    data.plannedEndTime = range.end;
    lineSession.set(lineUserId, { flow: 'addJob', step: 'description', data });
    return replyText(replyToken, ADD_JOB_PROMPTS.description);
  }

  // ขั้นตอนรายละเอียด
  if (!isSkip(value)) data.description = value;
  lineSession.clear(lineUserId);
  return finishAddJob(technician, data, replyToken);
};

// แสดงหลังเจองานจาก SR number ให้ช่างเช็คว่าใช่งานที่ต้องการก่อนทำขั้นต่อไป
const orderSummaryLines = (order) =>
  `เลขที่: ${order.srNumber}\nลูกค้า: ${order.customerName}\nสถานที่: ${order.customerLocation}`;

const startRescheduleSession = (lineUserId, replyToken) => {
  lineSession.set(lineUserId, { flow: 'reschedule', step: 'srNumber', data: {} });
  return replyText(replyToken,
    `เลื่อนงาน 🔄 (พิมพ์ "หยุด" เพื่อหยุดได้ทุกเมื่อ)\n\n${RESCHEDULE_PROMPTS.srNumber}`);
};

const handleRescheduleStep = async (text, technician, lineUserId, replyToken, session) => {
  const value = text.trim();

  if (ABORT_KEYWORDS.includes(value)) {
    lineSession.clear(lineUserId);
    return replyText(replyToken, 'ยกเลิกการเลื่อนงานแล้ว');
  }

  const { step, data } = session;

  if (step === 'srNumber') {
    const order = await WorkOrder.findOne({ where: { srNumber: value } });
    if (!order) {
      return replyText(replyToken, `ไม่พบงานเลขที่ ${value} กรุณาลองใหม่`);
    }
    const isOwner = order.technicianId === technician.id;
    const isSupervisor = isSupervisorRole(technician.role);
    if (!isOwner && !isSupervisor) {
      lineSession.clear(lineUserId);
      return replyText(replyToken, 'คุณไม่มีสิทธิเลื่อนงานนี้');
    }
    if (!RESCHEDULABLE_STATUSES.includes(order.status)) {
      lineSession.clear(lineUserId);
      return replyText(replyToken, `งาน ${value} มีสถานะ "${order.status}" ไม่สามารถเลื่อนได้`);
    }
    data.orderId = order.id;
    lineSession.set(lineUserId, { flow: 'reschedule', step: 'newDate', data });
    return replyText(replyToken,
      `${orderSummaryLines(order)}\nวันที่เดิม: ${formatThaiDate(order.plannedDate)}\n\n${RESCHEDULE_PROMPTS.newDate}`);
  }

  if (step === 'newDate') {
    const date = parseThaiDate(value);
    if (!date) {
      return replyText(replyToken, 'รูปแบบวันที่ไม่ถูกต้อง ลองใหม่ (วว/ดด/ปปปป) เช่น 20/09/2026');
    }
    data.newDate = date;
    lineSession.set(lineUserId, { flow: 'reschedule', step: 'reason', data });
    return replyText(replyToken, RESCHEDULE_PROMPTS.reason);
  }

  // ขั้นตอนเหตุผล
  lineSession.clear(lineUserId);
  const order = await WorkOrder.findByPk(data.orderId);
  if (!order) {
    return replyText(replyToken, 'ไม่พบงานนี้แล้ว (อาจถูกลบไปแล้ว)');
  }
  try {
    await rescheduleWorkOrder(order, {
      newDate: data.newDate, reason: value, changedById: technician.id, changedByName: technician.fullName, actorLabel: technician.username
    });
  } catch (error) {
    return replyText(replyToken, error.message);
  }
  return replyText(replyToken,
    `เลื่อนงาน ${order.srNumber} สำเร็จ ✅\nวันที่ใหม่: ${formatThaiDate(data.newDate)}\nสถานะ: รอหัวหน้าอนุมัติอีกครั้ง`);
};

const startCancelJobSession = (lineUserId, replyToken) => {
  lineSession.set(lineUserId, { flow: 'cancelJob', step: 'srNumber', data: {} });
  return replyText(replyToken,
    `ยกเลิกงาน 🚫 (พิมพ์ "หยุด" เพื่อหยุดได้ทุกเมื่อ)\n\n${CANCEL_JOB_PROMPTS.srNumber}`);
};

const handleCancelJobStep = async (text, technician, lineUserId, replyToken, session) => {
  const value = text.trim();

  if (ABORT_KEYWORDS.includes(value)) {
    lineSession.clear(lineUserId);
    return replyText(replyToken, 'ออกจากขั้นตอนยกเลิกงานแล้ว');
  }

  const { step, data } = session;

  if (step === 'srNumber') {
    const order = await WorkOrder.findOne({ where: { srNumber: value }, include: [{ model: User, as: 'technician' }] });
    if (!order) {
      return replyText(replyToken, `ไม่พบงานเลขที่ ${value} กรุณาลองใหม่`);
    }
    const isOwner = order.technicianId === technician.id;
    const isSupervisor = isSupervisorRole(technician.role);
    if (!isOwner && !isSupervisor) {
      lineSession.clear(lineUserId);
      return replyText(replyToken, 'คุณไม่มีสิทธิยกเลิกงานนี้');
    }
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      lineSession.clear(lineUserId);
      return replyText(replyToken, `งาน ${value} มีสถานะ "${order.status}" ไม่สามารถยกเลิกได้`);
    }
    data.orderId = order.id;
    data.isOwner = isOwner;
    data.isSupervisor = isSupervisor;
    lineSession.set(lineUserId, { flow: 'cancelJob', step: 'reason', data });
    return replyText(replyToken, `${orderSummaryLines(order)}\n\n${CANCEL_JOB_PROMPTS.reason}`);
  }

  // ขั้นตอนเหตุผล
  lineSession.clear(lineUserId);
  const order = await WorkOrder.findByPk(data.orderId, { include: [{ model: User, as: 'technician' }] });
  if (!order) {
    return replyText(replyToken, 'ไม่พบงานนี้แล้ว (อาจถูกลบไปแล้ว)');
  }
  try {
    await cancelWorkOrder(order, {
      cancelReason: value, cancelledById: technician.id,
      isOwnerCancelling: data.isOwner, isSupervisorCancelling: data.isSupervisor, actorLabel: technician.username
    });
  } catch (error) {
    return replyText(replyToken, error.message);
  }
  return replyText(replyToken, `ยกเลิกงาน ${order.srNumber} สำเร็จ ✅`);
};

const startActualSession = (lineUserId, replyToken) => {
  lineSession.set(lineUserId, { flow: 'actual', step: 'srNumber', data: {} });
  return replyText(replyToken,
    `บันทึกงานจริง 📝 (พิมพ์ "หยุด" เพื่อหยุดได้ทุกเมื่อ)\n\n${ACTUAL_PROMPTS.srNumber}`);
};

const finishActualWork = async (lineUserId, technician, data, replyToken) => {
  lineSession.clear(lineUserId);
  const order = await WorkOrder.findByPk(data.orderId);
  if (!order) {
    return replyText(replyToken, 'ไม่พบงานนี้แล้ว (อาจถูกลบไปแล้ว)');
  }

  try {
    await logActualWork(order, {
      actualDate: data.actualDate,
      actualStartTime: data.actualStartTime,
      actualEndTime: data.actualEndTime,
      actualLocation: data.actualLocation,
      actualDescription: data.actualDescription,
      repairCompleted: data.repairCompleted,
      repairIncompleteReason: data.repairIncompleteReason,
      installationDelivered: data.installationDelivered,
      recordedById: technician.id,
      actorLabel: technician.username
    });
  } catch (error) {
    return replyText(replyToken, error.message);
  }

  const statusLabel = order.status === 'completed' ? 'เสร็จสิ้น ✅' : 'อนุมัติแล้ว (ยังไม่เสร็จ)';
  return replyText(replyToken, `บันทึกงานจริง ${order.srNumber} สำเร็จ ✅\nสถานะ: ${statusLabel}`);
};

const handleActualStep = async (text, technician, lineUserId, replyToken, session) => {
  const value = text.trim();

  if (ABORT_KEYWORDS.includes(value)) {
    lineSession.clear(lineUserId);
    return replyText(replyToken, 'ยกเลิกการบันทึกงานจริงแล้ว');
  }

  const { step, data } = session;

  if (step === 'srNumber') {
    const order = await WorkOrder.findOne({ where: { srNumber: value } });
    if (!order) {
      return replyText(replyToken, `ไม่พบงานเลขที่ ${value} กรุณาลองใหม่`);
    }
    const isOwner = order.technicianId === technician.id;
    const isSupervisor = isSupervisorRole(technician.role);
    if (!isOwner && !isSupervisor) {
      lineSession.clear(lineUserId);
      return replyText(replyToken, 'คุณไม่มีสิทธิบันทึกงานนี้');
    }
    if (order.status !== 'approved') {
      lineSession.clear(lineUserId);
      return replyText(replyToken, `งาน ${value} มีสถานะ "${order.status}" ไม่สามารถบันทึกงานจริงได้ (ต้องเป็นสถานะ "อนุมัติแล้ว")`);
    }
    data.orderId = order.id;
    data.workType = order.workType;
    data.customerLocation = order.customerLocation;
    lineSession.set(lineUserId, { flow: 'actual', step: 'actualDate', data });
    return replyText(replyToken, `${orderSummaryLines(order)}\n\n${ACTUAL_PROMPTS.actualDate}`);
  }

  if (step === 'actualDate') {
    const date = parseThaiDate(value);
    if (!date) {
      return replyText(replyToken, 'รูปแบบวันที่ไม่ถูกต้อง ลองใหม่ (วว/ดด/ปปปป) เช่น 20/09/2026');
    }
    data.actualDate = date;
    lineSession.set(lineUserId, { flow: 'actual', step: 'actualTime', data });
    return replyText(replyToken, ACTUAL_PROMPTS.actualTime);
  }

  if (step === 'actualTime') {
    const range = parseTimeRange(value);
    if (!range) {
      return replyText(replyToken, 'รูปแบบเวลาไม่ถูกต้อง กรุณาระบุ (HH:MM-HH:MM) เช่น 09:00-12:00');
    }
    data.actualStartTime = range.start;
    data.actualEndTime = range.end;
    lineSession.set(lineUserId, { flow: 'actual', step: 'actualLocation', data });

    // โชว์สถานที่เดิมที่มีอยู่แล้ว ให้ช่างพิมพ์ข้ามเพื่อยืนยันได้เลยโดยไม่ต้องพิมพ์ใหม่
    // แต่ถ้าสถานที่จริงต่างจากแผน ก็แก้เป็นค่าใหม่ได้
    const prompt = data.customerLocation
      ? `${ACTUAL_PROMPTS.actualLocation}\nค่าปัจจุบัน: ${data.customerLocation}\n(พิมพ์ ข้าม เพื่อใช้ค่าเดิม หรือพิมพ์สถานที่ใหม่)`
      : ACTUAL_PROMPTS.actualLocation;
    return replyText(replyToken, prompt);
  }

  if (step === 'actualLocation') {
    data.actualLocation = (isSkip(value) && data.customerLocation) ? data.customerLocation : value;
    lineSession.set(lineUserId, { flow: 'actual', step: 'actualDescription', data });
    return replyText(replyToken, ACTUAL_PROMPTS.actualDescription);
  }

  if (step === 'actualDescription') {
    data.actualDescription = value;
    if (isRepairType(data.workType)) {
      lineSession.set(lineUserId, { flow: 'actual', step: 'repairCompleted', data });
      return replyText(replyToken, ACTUAL_PROMPTS.repairCompleted);
    }
    if (isInstallationType(data.workType)) {
      lineSession.set(lineUserId, { flow: 'actual', step: 'installationDelivered', data });
      return replyText(replyToken, ACTUAL_PROMPTS.installationDelivered);
    }
    return finishActualWork(lineUserId, technician, data, replyToken);
  }

  if (step === 'repairCompleted') {
    if (value === '1') {
      data.repairCompleted = true;
      return finishActualWork(lineUserId, technician, data, replyToken);
    }
    if (value === '2') {
      data.repairCompleted = false;
      lineSession.set(lineUserId, { flow: 'actual', step: 'repairIncompleteReason', data });
      return replyText(replyToken, ACTUAL_PROMPTS.repairIncompleteReason);
    }
    return replyText(replyToken, `เลือกไม่ถูกต้อง กรุณาพิมพ์ 1 หรือ 2\n\n${ACTUAL_PROMPTS.repairCompleted}`);
  }

  if (step === 'repairIncompleteReason') {
    data.repairIncompleteReason = value;
    return finishActualWork(lineUserId, technician, data, replyToken);
  }

  // ขั้นตอนส่งมอบเครื่อง
  if (value === '1') {
    data.installationDelivered = true;
  } else if (value === '2') {
    data.installationDelivered = false;
  } else {
    return replyText(replyToken, `เลือกไม่ถูกต้อง กรุณาพิมพ์ 1 หรือ 2\n\n${ACTUAL_PROMPTS.installationDelivered}`);
  }
  return finishActualWork(lineUserId, technician, data, replyToken);
};

const handleApprove = async (text, approver, replyToken) => {
  if (!isSupervisorRole(approver.role)) {
    return replyText(replyToken, 'คำสั่งนี้ใช้ได้เฉพาะหัวหน้าช่าง/แอดมินเท่านั้น');
  }

  const srNumber = text.match(APPROVE_KEYWORD)[1];
  const noteMatch = text.match(/หมายเหตุ\s*:\s*(.+)/);
  const approvalNote = noteMatch ? noteMatch[1].trim() : undefined;

  const order = await WorkOrder.findOne({ where: { srNumber } });
  if (!order) {
    return replyText(replyToken, `ไม่พบงานเลขที่ ${srNumber}`);
  }
  if (order.status !== 'pending_approval') {
    return replyText(replyToken, `งาน ${srNumber} ไม่ได้อยู่ในสถานะรออนุมัติ (สถานะปัจจุบัน: ${order.status})`);
  }

  await approveWorkOrder(order, {
    approvedById: approver.id, approvedByName: approver.fullName, approvalNote, actorLabel: `${approver.username} (LINE)`
  });
  return replyText(replyToken, `อนุมัติงาน ${srNumber} สำเร็จ ✅\nลูกค้า: ${order.customerName}`);
};

const LINE_CONTENT_URL = (messageId) => `https://api-data.line.me/v2/bot/message/${messageId}/content`;
const MAX_PHOTOS_PER_SESSION = 10;

// รูปภาพมีขนาดใหญ่กว่าข้อความที่ replyText ส่ง เลยตั้ง timeout โหลดไฟล์นานกว่า 5 วินาทีที่ใช้ตอบข้อความ
const downloadLineImage = async (messageId) => {
  const res = await fetch(LINE_CONTENT_URL(messageId), {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) {
    throw new Error(`LINE content download failed: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
};

const startPhotoSession = (lineUserId, replyToken) => {
  lineSession.set(lineUserId, { flow: 'photo', step: 'srNumber', data: {} });
  return replyText(replyToken,
    `ส่งรูปหน้างาน 📷 (พิมพ์ "หยุด" เพื่อหยุดได้ทุกเมื่อ)\n\nพิมพ์เลขที่งานที่จะแนบรูป เช่น SR-202609-0034`);
};

// จัดการข้อความตัวอักษรระหว่างอยู่ใน flow ส่งรูป ทั้งขั้นหา srNumber และคำว่าจบหรือเสร็จ
// ส่วนรูปจริงจะมาเป็น event image แยกต่างหาก จัดการที่ handlePhotoImage
const handlePhotoTextStep = async (text, technician, lineUserId, replyToken, session) => {
  const value = text.trim();

  if (ABORT_KEYWORDS.includes(value)) {
    lineSession.clear(lineUserId);
    return replyText(replyToken, 'ยกเลิกการส่งรูปแล้ว');
  }

  const { step, data } = session;

  if (step === 'srNumber') {
    const order = await WorkOrder.findOne({ where: { srNumber: value } });
    if (!order) {
      return replyText(replyToken, `ไม่พบงานเลขที่ ${value} กรุณาลองใหม่`);
    }
    const isOwner = order.technicianId === technician.id;
    const isSupervisor = isSupervisorRole(technician.role);
    if (!isOwner && !isSupervisor) {
      lineSession.clear(lineUserId);
      return replyText(replyToken, 'คุณไม่มีสิทธิแนบรูปงานนี้');
    }
    if (order.status === 'cancelled') {
      lineSession.clear(lineUserId);
      return replyText(replyToken, `งาน ${value} ถูกยกเลิกแล้ว ไม่สามารถแนบรูปได้`);
    }
    data.orderId = order.id;
    data.count = 0;
    lineSession.set(lineUserId, { flow: 'photo', step: 'awaitingPhoto', data });
    return replyText(replyToken, `${orderSummaryLines(order)}\n\nส่งรูปมาได้เลยครับ (ส่งได้หลายรูป พิมพ์ "จบ" เมื่อเสร็จ)`);
  }

  // ขั้นตอนรอรับรูป แต่ได้ข้อความแทนรูปภาพ
  if (value === 'จบ' || value === 'เสร็จ') {
    lineSession.clear(lineUserId);
    return replyText(replyToken, data.count > 0
      ? `แนบรูปสำเร็จ ${data.count} รูป ✅`
      : 'ยังไม่ได้แนบรูปเลยครับ ส่งรูปมาได้เลย หรือพิมพ์ "หยุด" เพื่อยกเลิก');
  }
  return replyText(replyToken, 'ส่งรูปภาพมาได้เลยครับ หรือพิมพ์ "จบ" เมื่อเสร็จ');
};

// จัดการข้อความรูปภาพที่เข้ามาตอนอยู่ขั้น awaitingPhoto จงใจไม่เคลียร์ session ถ้า error
// เพราะไม่อยากให้ช่างต้องพิมพ์เลขที่งานใหม่แค่เพราะโหลดหรือเซฟรูปพลาดครั้งเดียว
const handlePhotoImage = async (messageId, technician, lineUserId, replyToken, session) => {
  const { data } = session;

  let buffer;
  try {
    buffer = await downloadLineImage(messageId);
  } catch (error) {
    logger.error(`LINE image download error: ${error.message}`);
    return replyText(replyToken, 'โหลดรูปจาก LINE ไม่สำเร็จ ลองส่งใหม่อีกครั้ง');
  }

  // session เก็บแค่ orderId ข้าม request ไม่ใช่ instance ของ Sequelize ที่ยังใช้งานได้
  // เลยต้องดึงข้อมูล order ใหม่ทุกครั้งที่รับรูป
  const order = await WorkOrder.findByPk(data.orderId);
  if (!order) {
    lineSession.clear(lineUserId);
    return replyText(replyToken, 'ไม่พบงานนี้แล้ว (อาจถูกลบไปแล้ว)');
  }

  try {
    const url = await saveCompressedPhoto(order.id, buffer);
    await addPhotos(order, [url], technician.username);
  } catch (error) {
    logger.error(`LINE photo save error: ${error.message}`);
    return replyText(replyToken, 'บันทึกรูปไม่สำเร็จ ลองส่งใหม่อีกครั้ง');
  }

  data.count += 1;
  if (data.count >= MAX_PHOTOS_PER_SESSION) {
    lineSession.clear(lineUserId);
    return replyText(replyToken, `แนบรูปสำเร็จ ${data.count} รูป ✅ (ครบจำนวนสูงสุดต่อครั้งแล้ว)`);
  }
  lineSession.set(lineUserId, { flow: 'photo', step: 'awaitingPhoto', data });
  return replyText(replyToken, `📷 รับรูปแล้ว (${data.count}) ส่งต่อได้อีก หรือพิมพ์ "จบ"`);
};

router.post('/webhook', async (req, res) => {
  if (!verifySignature(req)) {
    logger.warn(`LINE webhook: invalid signature (hasHeader=${!!req.headers['x-line-signature']}, hasRawBody=${!!req.rawBody})`);
    return res.status(401).send('Invalid signature');
  }

  const events = req.body.events || [];
  logger.info(`LINE webhook: received ${events.length} event(s)`);
  for (const event of events) {
    try {
      logger.info(`LINE webhook event: type=${event.type} messageType=${event.message?.type} text=${JSON.stringify(event.message?.text)}`);
      if (event.type !== 'message') continue;
      const messageType = event.message.type;
      if (messageType !== 'text' && messageType !== 'image') continue;

      const lineUserId = event.source.userId;
      const { replyToken } = event;

      if (messageType === 'image') {
        const imageTechnician = await User.findOne({ where: { lineUserId } });
        if (!imageTechnician) {
          await replyText(replyToken, LINK_HELP_TEXT);
          continue;
        }
        const photoSession = lineSession.get(lineUserId);
        if (photoSession && photoSession.flow === 'photo' && photoSession.step === 'awaitingPhoto') {
          logger.info(`LINE webhook: handling photo image from ${imageTechnician.username}`);
          await handlePhotoImage(event.message.id, imageTechnician, lineUserId, replyToken, photoSession);
        } else {
          await replyText(replyToken, 'พิมพ์ "ส่งรูป" ก่อน แล้วระบุเลขที่งาน ถึงจะแนบรูปได้ครับ');
        }
        continue;
      }

      const text = event.message.text.trim();

      if (text === 'login') {
        logger.info(`LINE webhook: starting login session for lineUserId=${lineUserId}`);
        await startLoginSession(lineUserId, replyToken);
        continue;
      }

      if (/^login\s+\S+\s+\S+/i.test(text)) {
        await handleLinkAccount(text, lineUserId, replyToken);
        continue;
      }

      const loginSession = lineSession.get(lineUserId);
      if (loginSession && loginSession.flow === 'login') {
        logger.info(`LINE webhook: handling login step "${loginSession.step}" for lineUserId=${lineUserId}`);
        await handleLoginStep(text, lineUserId, replyToken, loginSession);
        continue;
      }

      const technician = await User.findOne({ where: { lineUserId } });
      if (!technician) {
        logger.info(`LINE webhook: no technician linked to lineUserId=${lineUserId}`);
        await replyText(replyToken, LINK_HELP_TEXT);
        continue;
      }

      const session = lineSession.get(lineUserId);
      if (session && session.flow === 'addJob') {
        logger.info(`LINE webhook: handling add-job step "${session.step}" from ${technician.username}`);
        await handleAddJobStep(text, technician, lineUserId, replyToken, session);
      } else if (session && session.flow === 'reschedule') {
        logger.info(`LINE webhook: handling reschedule step "${session.step}" from ${technician.username}`);
        await handleRescheduleStep(text, technician, lineUserId, replyToken, session);
      } else if (session && session.flow === 'cancelJob') {
        logger.info(`LINE webhook: handling cancel-job step "${session.step}" from ${technician.username}`);
        await handleCancelJobStep(text, technician, lineUserId, replyToken, session);
      } else if (session && session.flow === 'actual') {
        logger.info(`LINE webhook: handling actual-work step "${session.step}" from ${technician.username}`);
        await handleActualStep(text, technician, lineUserId, replyToken, session);
      } else if (session && session.flow === 'photo') {
        logger.info(`LINE webhook: handling photo-attach step "${session.step}" from ${technician.username}`);
        await handlePhotoTextStep(text, technician, lineUserId, replyToken, session);
      } else if (text === 'เพิ่มงาน') {
        logger.info(`LINE webhook: starting add-job session for ${technician.username}`);
        await startAddJobSession(lineUserId, replyToken);
      } else if (text === 'เลื่อนงาน') {
        logger.info(`LINE webhook: starting reschedule session for ${technician.username}`);
        await startRescheduleSession(lineUserId, replyToken);
      } else if (text === 'ยกเลิกงาน') {
        logger.info(`LINE webhook: starting cancel-job session for ${technician.username}`);
        await startCancelJobSession(lineUserId, replyToken);
      } else if (text === 'บันทึกงานจริง') {
        logger.info(`LINE webhook: starting actual-work session for ${technician.username}`);
        await startActualSession(lineUserId, replyToken);
      } else if (text === 'ส่งรูป') {
        logger.info(`LINE webhook: starting photo-attach session for ${technician.username}`);
        await startPhotoSession(lineUserId, replyToken);
      } else if (isAddJobMessage(text)) {
        logger.info(`LINE webhook: handling one-shot add-job message from ${technician.username}`);
        await handleAddJob(text, technician, replyToken);
      } else if (isApproveMessage(text)) {
        logger.info(`LINE webhook: handling approve message from ${technician.username}`);
        await handleApprove(text, technician, replyToken);
      } else {
        logger.info(`LINE webhook: message from ${technician.username} did not match add-job format, sending help text`);
        const roleHelp = isSupervisorRole(technician.role) ? `\n\n${APPROVE_HELP_TEXT}` : '';
        await replyText(replyToken, `${HELP_TEXT}${roleHelp}\n\n${LOGIN_SWITCH_TEXT}`);
      }
    } catch (error) {
      logger.error(`LINE webhook event error: ${error.message}\n${error.stack}`);
    }
  }

  res.status(200).send('OK');
});

module.exports = router;
