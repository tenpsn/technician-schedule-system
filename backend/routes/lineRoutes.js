const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const WorkOrder = require('../models/WorkOrder');
const Notification = require('../models/Notification');
const { createWorkOrder } = require('../services/workOrderService');
const { isAddJobMessage, parseAddJobMessage, parseThaiDate, parseTimeRange } = require('../utils/lineJobParser');
const lineSession = require('../utils/lineSession');
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
รายละเอียด: รายละเอียดงาน (ไม่บังคับ)`;

const LOGIN_SWITCH_TEXT =
`ต้องการเปลี่ยนบัญชีที่เชื่อมไว้ พิมพ์ "login" แล้วบอทจะถามทีละขั้น
หรือพิมพ์บรรทัดเดียว: login ชื่อผู้ใช้ รหัสผ่าน`;

const WORK_TYPE_OPTIONS = ['MA', 'ติดตั้ง', 'ซ่อม', 'อื่นๆ'];

const ADD_JOB_PROMPTS = {
  customerName: 'พิมพ์ชื่อลูกค้า/โรงพยาบาล',
  customerLocation: 'ไม่พบชื่อนี้ในฐานข้อมูล รพ. กรุณาพิมพ์สถานที่ปฏิบัติงาน',
  workType: `ประเภทงาน\n\n${WORK_TYPE_OPTIONS.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`,
  workTypeOther: 'อื่นๆ โปรดระบุ',
  plannedDate: 'วันที่ปฏิบัติงาน เช่น 15/09/2026',
  plannedTime: 'เวลา (HH:MM-HH:MM) เช่น 09:00-12:00',
  description: 'รายละเอียดงาน (ถ้าไม่มีพิมพ์ - หรือ ข้าม)'
};

const CANCEL_KEYWORDS = ['ยกเลิก', 'ยกเลิกเพิ่มงาน'];
const SKIP_KEYWORDS = ['ข้าม', 'ไม่มี', 'ไม่ระบุ', '-', 'skip'];
const isSkip = (value) => SKIP_KEYWORDS.includes(value.toLowerCase());

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

// This office network's DNS resolution for api.line.me is intermittently
// flaky — it can time out and then succeed moments later — so a single
// immediate retry isn't reliable enough; wait a bit and try a few times.
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
      // Without this, a stalled DNS lookup hangs for ~10s before undici gives
      // up on its own — fail faster so a retry has time to actually help.
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
  user.lineUserId = lineUserId;
  await user.save();
  logger.info(`LINE account linked: ${user.username}`);
  const roleHelp = ['supervisor', 'admin'].includes(user.role) ? `\n\n${APPROVE_HELP_TEXT}` : '';
  return replyText(replyToken,
    `เชื่อมบัญชีสำเร็จ ✅ สวัสดีคุณ ${user.fullName}\n\n${HELP_TEXT}${roleHelp}\n\n${LOGIN_SWITCH_TEXT}`);
};

// One-shot format: "login <username> <password>" on a single line.
const handleLinkAccount = async (text, lineUserId, replyToken) => {
  const [, username, password] = text.split(/\s+/);
  if (!username || !password) {
    return replyText(replyToken, 'รูปแบบไม่ถูกต้อง พิมพ์: login ชื่อผู้ใช้ รหัสผ่าน');
  }

  const user = await User.findOne({ where: { username } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.password))) {
    return replyText(replyToken, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }

  return finishLogin(user, lineUserId, replyToken);
};

// Step-by-step format: bare "login" starts a session asking username then password.
const startLoginSession = (lineUserId, replyToken) => {
  lineSession.set(lineUserId, { flow: 'login', step: 'username', data: {} });
  return replyText(replyToken,
    `เข้าสู่ระบบ 🔐 (พิมพ์ "ยกเลิก" เพื่อหยุดได้ทุกเมื่อ)\n\n${LOGIN_PROMPTS.username}`);
};

const handleLoginStep = async (text, lineUserId, replyToken, session) => {
  const value = text.trim();

  if (CANCEL_KEYWORDS.includes(value)) {
    lineSession.clear(lineUserId);
    return replyText(replyToken, 'ยกเลิกการเข้าสู่ระบบแล้ว');
  }

  const { step, data } = session;

  if (step === 'username') {
    data.username = value;
    lineSession.set(lineUserId, { flow: 'login', step: 'password', data });
    return replyText(replyToken, LOGIN_PROMPTS.password);
  }

  // step === 'password'
  lineSession.clear(lineUserId);
  const user = await User.findOne({ where: { username: data.username } });
  if (!user || !user.active || !(await bcrypt.compare(value, user.password))) {
    return replyText(replyToken, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง พิมพ์ "login" เพื่อลองใหม่');
  }

  return finishLogin(user, lineUserId, replyToken);
};

// The hospital master list only stores a short name (e.g. "ท่าวังผ่า") and
// province, so "ลูกค้า" typed in the LINE message is matched against it to
// fill in "สถานที่" automatically when the technician leaves it out.
const findHospitalMatch = async (customerName) => {
  const cleaned = customerName.replace(/^รพ\.?\s*/, '').trim();

  const exact = await Hospital.findOne({ where: { name: { [Op.iLike]: cleaned } } });
  if (exact) return exact;

  const partial = await Hospital.findAll({
    where: { name: { [Op.iLike]: `%${cleaned}%` } },
    limit: 2
  });
  return partial.length === 1 ? partial[0] : null;
};

const finishAddJob = async (technician, data, replyToken) => {
  const workOrder = await createWorkOrder({ technician, ...data });
  return replyText(replyToken,
    `เพิ่มงานสำเร็จ ✅\nเลขที่: ${workOrder.srNumber}\nลูกค้า: ${workOrder.customerName}\n` +
    `วันที่: ${data.plannedDate.toLocaleDateString('th-TH')}\n\nสถานะ: รอหัวหน้าอนุมัติ`);
};

// One-shot format: all fields in a single labeled message.
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
    result.data.customerLocation = `จังหวัด${hospital.province}`;
  }

  return finishAddJob(technician, result.data, replyToken);
};

// Step-by-step format: bare "เพิ่มงาน" starts a session, then one field per reply.
const startAddJobSession = (lineUserId, replyToken) => {
  lineSession.set(lineUserId, { flow: 'addJob', step: 'customerName', data: {} });
  return replyText(replyToken,
    `เริ่มเพิ่มงานใหม่ ✏️ (พิมพ์ "ยกเลิก" เพื่อหยุดได้ทุกเมื่อ)\n\n${ADD_JOB_PROMPTS.customerName}`);
};

const handleAddJobStep = async (text, technician, lineUserId, replyToken, session) => {
  const value = text.trim();

  if (CANCEL_KEYWORDS.includes(value)) {
    lineSession.clear(lineUserId);
    return replyText(replyToken, 'ยกเลิกการเพิ่มงานแล้ว');
  }

  const { step, data } = session;

  if (step === 'customerName') {
    data.customerName = value;
    const hospital = await findHospitalMatch(value);
    if (hospital) {
      data.customerLocation = `จังหวัด${hospital.province}`;
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
    const optionIndex = WORK_TYPE_OPTIONS.findIndex(
      (opt, i) => value === String(i + 1) || value.toLowerCase() === opt.toLowerCase()
    );
    if (optionIndex === -1) {
      return replyText(replyToken, `เลือกไม่ถูกต้อง กรุณาพิมพ์ตัวเลข 1-${WORK_TYPE_OPTIONS.length}\n\n${ADD_JOB_PROMPTS.workType}`);
    }
    if (WORK_TYPE_OPTIONS[optionIndex] === 'อื่นๆ') {
      lineSession.set(lineUserId, { flow: 'addJob', step: 'workTypeOther', data });
      return replyText(replyToken, ADD_JOB_PROMPTS.workTypeOther);
    }
    data.workType = WORK_TYPE_OPTIONS[optionIndex];
    lineSession.set(lineUserId, { flow: 'addJob', step: 'plannedDate', data });
    return replyText(replyToken, ADD_JOB_PROMPTS.plannedDate);
  }

  if (step === 'workTypeOther') {
    data.workType = 'อื่นๆ';
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
    // Required — unlike the other optional fields, ข้าม/ไม่มี is not accepted here.
    const range = parseTimeRange(value);
    if (!range) {
      return replyText(replyToken, 'รูปแบบเวลาไม่ถูกต้อง กรุณาระบุเวลา (HH:MM-HH:MM) เช่น 09:00-12:00');
    }
    data.plannedStartTime = range.start;
    data.plannedEndTime = range.end;
    lineSession.set(lineUserId, { flow: 'addJob', step: 'description', data });
    return replyText(replyToken, ADD_JOB_PROMPTS.description);
  }

  // step === 'description'
  if (!isSkip(value)) data.description = value;
  lineSession.clear(lineUserId);
  return finishAddJob(technician, data, replyToken);
};

const handleApprove = async (text, approver, replyToken) => {
  if (!['supervisor', 'admin'].includes(approver.role)) {
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

  order.status = 'approved';
  order.approvedById = approver.id;
  order.approvedAt = new Date();
  if (approvalNote) order.approvalNote = approvalNote;
  await order.save();

  await Notification.create({
    recipientId: order.technicianId,
    type: 'approval_needed',
    title: '✅ แผนงานได้รับการอนุมัติ',
    message: `งาน ${order.srNumber} (${order.customerName}) ได้รับการอนุมัติแล้ว`,
    relatedWorkOrderId: order.id
  });

  logger.info(`Work order approved via LINE: ${order.srNumber} by ${approver.username}`);
  return replyText(replyToken, `อนุมัติงาน ${srNumber} สำเร็จ ✅\nลูกค้า: ${order.customerName}`);
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
      if (event.type !== 'message' || event.message.type !== 'text') continue;

      const text = event.message.text.trim();
      const lineUserId = event.source.userId;
      const { replyToken } = event;

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
      } else if (text === 'เพิ่มงาน') {
        logger.info(`LINE webhook: starting add-job session for ${technician.username}`);
        await startAddJobSession(lineUserId, replyToken);
      } else if (isAddJobMessage(text)) {
        logger.info(`LINE webhook: handling one-shot add-job message from ${technician.username}`);
        await handleAddJob(text, technician, replyToken);
      } else if (isApproveMessage(text)) {
        logger.info(`LINE webhook: handling approve message from ${technician.username}`);
        await handleApprove(text, technician, replyToken);
      } else {
        logger.info(`LINE webhook: message from ${technician.username} did not match add-job format, sending help text`);
        const roleHelp = ['supervisor', 'admin'].includes(technician.role) ? `\n\n${APPROVE_HELP_TEXT}` : '';
        await replyText(replyToken, `${HELP_TEXT}${roleHelp}\n\n${LOGIN_SWITCH_TEXT}`);
      }
    } catch (error) {
      logger.error(`LINE webhook event error: ${error.message}\n${error.stack}`);
    }
  }

  res.status(200).send('OK');
});

module.exports = router;
