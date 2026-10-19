process.env.LINE_CHANNEL_SECRET = 'test-line-secret';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-line-token';

const crypto = require('crypto');
const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const WorkOrder = require('../models/WorkOrder');
const Notification = require('../models/Notification');
const { createWorkOrder, approveWorkOrder, logActualWork } = require('../services/workOrderService');

// เก็บข้อความที่บอทตอบกลับแทนการยิงไป LINE จริง
const replies = [];
global.fetch = jest.fn(async (url, opts) => {
  replies.push(JSON.parse(opts.body).messages[0].text);
  return { ok: true, text: async () => '' };
});

// ส่งข้อความเข้า webhook พร้อมลายเซ็นจริง แล้วคืนข้อความที่บอทตอบ
const send = async (lineUserId, text) => {
  const body = JSON.stringify({
    events: [{ type: 'message', replyToken: 'r', source: { userId: lineUserId }, message: { type: 'text', text } }]
  });
  const signature = crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET).update(body).digest('base64');
  replies.length = 0;
  await request(app).post('/api/line/webhook')
    .set('Content-Type', 'application/json').set('x-line-signature', signature).send(body);
  return replies[0];
};

const SOUTH_SUP = 'U-south-sup';
const SOUTH_TECH = 'U-south-tech';
const NORTH_TECH = 'U-north-tech';
const REGION_DENIED = 'หัวหน้าช่างภาคใต้จัดการได้แค่งานของช่างภาคใต้เท่านั้น';

let southSup, southTech, northTech;
let southOrder, northOrder;

const newOrder = (technician, customerName) => createWorkOrder({
  technician, customerName, customerLocation: 'ทดสอบ', workType: 'ซ่อม',
  plannedDate: new Date(Date.UTC(2026, 9, 1)), plannedStartTime: '09:00', plannedEndTime: '12:00'
});

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const password = 'unused-password-hash';
  southSup = await User.create({ username: 'line_south_sup', password, fullName: 'South Sup', role: 'supervisor', province: 'สงขลา', lineUserId: SOUTH_SUP });
  southTech = await User.create({ username: 'line_south_tech', password, fullName: 'South Tech', role: 'technician', province: 'สงขลา', lineUserId: SOUTH_TECH });
  northTech = await User.create({ username: 'line_north_tech', password, fullName: 'North Tech', role: 'technician', province: 'เชียงใหม่', lineUserId: NORTH_TECH });
  await User.create({ username: 'line_admin', password, fullName: 'Admin', role: 'admin', province: 'กรุงเทพมหานคร' });
  southOrder = await newOrder(southTech, 'รพ.ใต้');
  northOrder = await newOrder(northTech, 'รพ.เหนือ');
});

afterAll(async () => {
  try {
    await sequelize.drop();
  } catch (error) {
    // เหมือนเทสต์อื่น schema จะถูกสร้างใหม่ตอน sync force รอบถัดไปอยู่แล้ว
  }
  await sequelize.close();
});

describe('LINE bot matches web rules', () => {
  test('southern supervisor cannot approve a non-southern job', async () => {
    expect(await send(SOUTH_SUP, `อนุมัติ ${northOrder.srNumber}`)).toBe(REGION_DENIED);
    expect((await WorkOrder.findByPk(northOrder.id)).status).toBe('pending_approval');
  });

  test('southern supervisor can approve a southern job', async () => {
    expect(await send(SOUTH_SUP, `อนุมัติ ${southOrder.srNumber}`)).toContain('สำเร็จ');
    expect((await WorkOrder.findByPk(southOrder.id)).status).toBe('approved');
  });

  test('southern supervisor is blocked from reschedule, cancel and photos on a non-southern job', async () => {
    for (const command of ['เลื่อนงาน', 'ยกเลิกงาน', 'ส่งรูป']) {
      await send(SOUTH_SUP, command);
      expect(await send(SOUTH_SUP, northOrder.srNumber)).toBe(REGION_DENIED);
    }
  });

  test('supervisor can log actual work for a southern technician and is recorded as the recorder', async () => {
    await send(SOUTH_SUP, 'บันทึกงานจริง');
    await send(SOUTH_SUP, southOrder.srNumber);
    await send(SOUTH_SUP, '01/10/2026');
    await send(SOUTH_SUP, 'ข้าม');
    await send(SOUTH_SUP, 'ข้าม');
    await send(SOUTH_SUP, 'ช่างโทรแจ้งว่าเปลี่ยนอะไหล่แล้ว');
    expect(await send(SOUTH_SUP, '1')).toContain('สำเร็จ');
    const order = await WorkOrder.findByPk(southOrder.id);
    expect(order.actualLog[0]).toMatchObject({ recordedById: southSup.id, recordedByName: 'South Sup' });
  });

  test('southern supervisor cannot log actual work on a non-southern job', async () => {
    await send(SOUTH_SUP, 'บันทึกงานจริง');
    expect(await send(SOUTH_SUP, northOrder.srNumber)).toBe(REGION_DENIED);
  });

  test('owner can log actual work on an overdue job and skip time to use the planned time', async () => {
    await WorkOrder.update({ status: 'overdue', isOverdue: true }, { where: { id: southOrder.id } });
    await send(SOUTH_TECH, 'บันทึกงานจริง');
    await send(SOUTH_TECH, southOrder.srNumber);
    expect(await send(SOUTH_TECH, '01/10/2026')).toContain('เวลาตามแผน: 09:00-12:00');
    await send(SOUTH_TECH, 'ข้าม');
    await send(SOUTH_TECH, 'ข้าม');
    await send(SOUTH_TECH, 'เปลี่ยนอะไหล่');
    expect(await send(SOUTH_TECH, '1')).toContain('สำเร็จ');
    const order = await WorkOrder.findByPk(southOrder.id);
    expect(order.status).toBe('completed');
    expect([order.actualStartTime, order.actualEndTime]).toEqual(['09:00', '12:00']);
  });

  test('owner can reschedule an overdue job and the notice shows a Thai date', async () => {
    await WorkOrder.update({ status: 'overdue', isOverdue: true }, { where: { id: northOrder.id } });
    await send(NORTH_TECH, 'เลื่อนงาน');
    await send(NORTH_TECH, northOrder.srNumber);
    await send(NORTH_TECH, '20/10/2026');
    expect(await send(NORTH_TECH, 'ลูกค้าไม่ว่าง')).toContain('สำเร็จ');

    const notes = await Notification.findAll({ where: { code: 'job_rescheduled' } });
    expect(notes.some((n) => n.recipientId === southSup.id)).toBe(false);
    expect(notes[0].message).toContain('เป็น 20/10/2569');
  });

  test('statuses are shown in Thai', async () => {
    await send(NORTH_TECH, 'ยกเลิกงาน');
    await send(NORTH_TECH, northOrder.srNumber);
    await send(NORTH_TECH, 'ทดสอบ');
    await send(NORTH_TECH, 'ยกเลิกงาน');
    expect(await send(NORTH_TECH, northOrder.srNumber)).toContain('"ยกเลิกแล้ว"');
  });

  test('one-shot add job needs a time with end after start', async () => {
    const base = 'เพิ่มงาน\nลูกค้า: รพ.ก\nสถานที่: ที่ไหน\nประเภทงาน: MA\nวันที่: 20/10/2026';
    expect(await send(NORTH_TECH, base)).toContain('ขาด: เวลา');
    expect(await send(NORTH_TECH, `${base}\nเวลา: 12:00-09:00`)).toContain('เวลาจบต้องหลังเวลาเริ่ม');
  });

  test('one-shot add job maps an unknown work type to other with a note', async () => {
    const text = 'เพิ่มงาน\nลูกค้า: รพ.ข\nสถานที่: ที่ไหน\nประเภทงาน: ตรวจเช็คระบบ\nวันที่: 20/10/2026\nเวลา: 09:00-10:00';
    expect(await send(NORTH_TECH, text)).toContain('สำเร็จ');
    const order = await WorkOrder.findOne({ where: { customerName: 'รพ.ข' } });
    expect(order.workType).toBe('อื่นๆ');
    expect(order.description).toBe('ประเภทงาน: ตรวจเช็คระบบ');
  });
});

describe('ตรวจรับบันทึกงานจริงใน LINE', () => {
  // งานที่อนุมัติแล้วและมีบันทึกงานจริงรอตรวจรับตามจำนวนที่ต้องการ
  const jobWithPendingActual = async (technician, customerName, logCount = 1) => {
    const order = await newOrder(technician, customerName);
    await approveWorkOrder(order, { approvedById: southSup.id });
    for (let i = 0; i < logCount; i++) {
      await logActualWork(order, {
        actualDate: '2026-10-01', actualDescription: `รอบที่ ${i + 1}`, repairCompleted: true,
        recordedById: technician.id, recordedByName: technician.fullName
      });
    }
    return order;
  };

  test('ช่างบันทึกงานจริงแล้วบอทบอกว่ารอหัวหน้าตรวจรับ', async () => {
    const order = await newOrder(southTech, 'รพ.บันทึก');
    await approveWorkOrder(order, { approvedById: southSup.id });
    await send(SOUTH_TECH, 'บันทึกงานจริง');
    await send(SOUTH_TECH, order.srNumber);
    await send(SOUTH_TECH, '01/10/2026');
    await send(SOUTH_TECH, 'ข้าม');
    await send(SOUTH_TECH, 'ข้าม');
    await send(SOUTH_TECH, 'เปลี่ยนอะไหล่แล้ว');
    expect(await send(SOUTH_TECH, '1')).toContain('รอหัวหน้าตรวจรับ');
  });

  test('รอตรวจรับแสดงแค่งานภาคใต้ให้หัวหน้าภาคใต้', async () => {
    const south = await jobWithPendingActual(southTech, 'รพ.รอใต้');
    const north = await jobWithPendingActual(northTech, 'รพ.รอเหนือ');
    const reply = await send(SOUTH_SUP, 'รอตรวจรับ');
    expect(reply).toMatch(/^รอตรวจรับ \d+ รายการ\n/);
    // ทุกบรรทัดมีเลขลำดับนำหน้า เช่น 1. 2. 3.
    expect(reply.split('\n').slice(1).every((line, i) => line.startsWith(`${i + 1}. `))).toBe(true);
    expect(reply).toContain(`. ${south.srNumber} #1 รพ.รอใต้ (South Tech)`);
    expect(reply).not.toContain(north.srNumber);
  });

  test('รออนุมัติแสดงประเภทงาน ลูกค้า ช่าง และวันที่ เฉพาะภาคใต้', async () => {
    const south = await newOrder(southTech, 'รพ.รออนุมัติใต้');
    const north = await newOrder(northTech, 'รพ.รออนุมัติเหนือ');
    const reply = await send(SOUTH_SUP, 'รออนุมัติ');
    expect(reply).toMatch(/^รออนุมัติ \d+ รายการ\n/);
    expect(reply.split('\n').slice(1).every((line, i) => line.startsWith(`${i + 1}. `))).toBe(true);
    expect(reply).toContain(`. ${south.srNumber} ซ่อม รพ.รออนุมัติใต้ (South Tech) 1/10/2569`);
    expect(reply).not.toContain(north.srNumber);
    expect(await send(SOUTH_TECH, 'รออนุมัติ')).toContain('เฉพาะหัวหน้าช่าง');
  });

  test('ช่างใช้คำสั่งตรวจรับไม่ได้ และหัวหน้าภาคใต้ตรวจรับงานภาคอื่นไม่ได้', async () => {
    const north = await jobWithPendingActual(northTech, 'รพ.เหนือตรวจ');
    expect(await send(SOUTH_TECH, `ตรวจรับ ${north.srNumber}`)).toContain('เฉพาะหัวหน้าช่าง');
    expect(await send(SOUTH_SUP, `ตรวจรับ ${north.srNumber}`)).toBe(REGION_DENIED);
  });

  test('ตรวจรับผ่าน และมีหลายรายการต้องใส่ลำดับ', async () => {
    const order = await jobWithPendingActual(southTech, 'รพ.สองรอบ', 2);
    expect(await send(SOUTH_SUP, `ตรวจรับ ${order.srNumber}`)).toContain('กรุณาใส่ลำดับ');
    expect(await send(SOUTH_SUP, `ตรวจรับ ${order.srNumber} 2`)).toContain('สำเร็จ');
    expect(await send(SOUTH_SUP, `ตรวจรับ ${order.srNumber}`)).toContain('สำเร็จ');
    await order.reload();
    expect(order.actualLog.map((l) => l.verifyResult)).toEqual(['passed', 'passed']);
    expect(await send(SOUTH_SUP, `ตรวจรับ ${order.srNumber}`)).toContain('ไม่มีบันทึกงานจริงที่รอตรวจรับ');
  });

  test('ไม่ผ่านถามวันที่ เวลา รายละเอียด แล้วสร้างงานต่อ', async () => {
    const order = await jobWithPendingActual(southTech, 'รพ.ไม่ผ่าน');
    expect(await send(SOUTH_SUP, `ไม่ผ่าน ${order.srNumber}`)).toContain('วันที่นัดงานใหม่');
    expect(await send(SOUTH_SUP, '20/10/2026')).toContain('เวลาของงานเดิม: 09:00-12:00');
    await send(SOUTH_SUP, '13:00-15:00');
    const reply = await send(SOUTH_SUP, 'เครื่องยังมีเสียงดัง');
    expect(reply).toContain(`สร้างงานใหม่ ${order.srNumber}-2 สำเร็จ`);

    await order.reload();
    expect(order.status).toBe('completed');
    expect(order.actualLog[0]).toMatchObject({ verifyResult: 'rejected', followUpSrNumber: `${order.srNumber}-2` });
    const followUp = await WorkOrder.findOne({ where: { srNumber: `${order.srNumber}-2` } });
    expect(followUp).toMatchObject({
      status: 'approved', technicianId: southTech.id, description: 'เครื่องยังมีเสียงดัง', plannedStartTime: '13:00', plannedEndTime: '15:00'
    });
  });

  test('พิมพ์หยุดระหว่างไม่ผ่าน บันทึกยังรอตรวจรับเหมือนเดิม', async () => {
    const order = await jobWithPendingActual(southTech, 'รพ.หยุด');
    await send(SOUTH_SUP, `ไม่ผ่าน ${order.srNumber}`);
    expect(await send(SOUTH_SUP, 'หยุด')).toContain('ยังรอตรวจรับ');
    await order.reload();
    expect(order.actualLog[0].verifiedAt).toBeNull();
    expect(order.status).not.toBe('cancelled');
  });

  test('ข้อความช่วยเหลือของหัวหน้ามีคำสั่งตรวจรับ', async () => {
    const help = await send(SOUTH_SUP, 'สวัสดี');
    expect(help).toContain('รอตรวจรับ');
    expect(help).toContain('ไม่ผ่าน เลขที่งาน');
  });
});
