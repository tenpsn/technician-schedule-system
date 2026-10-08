const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const Notification = require('../models/Notification');
const WorkOrder = require('../models/WorkOrder');
const Hospital = require('../models/Hospital');
const Contract = require('../models/Contract');
const MaVisit = require('../models/MaVisit');
const { findSupervisorsToNotify } = require('../services/workOrderService');

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

let southSupToken, northSupToken, southTechToken, northTechToken;
let southSupId, northSupId, southTechId, northTechId;
let southOrderId, northOrderId;

const login = async (username) => {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'test123' });
  return res.body.token;
};

const createOrder = async (token, customerName) => {
  const res = await request(app)
    .post('/api/work-orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ customerName, customerLocation: 'ทดสอบ', workType: 'MA', plannedDate: '2026-10-01' });
  return res.body._id;
};

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const bcrypt = require('bcryptjs');
  const password = await bcrypt.hash('test123', await bcrypt.genSalt(10));

  // จังหวัดเป็นตัวกำหนดภาค สงขลาอยู่ภาคใต้ เชียงใหม่อยู่ภาคเหนือ
  southSupId = (await User.create({ username: 'southsup', password, fullName: 'South Sup', role: 'supervisor', province: 'สงขลา' })).id;
  northSupId = (await User.create({ username: 'northsup', password, fullName: 'North Sup', role: 'supervisor', province: 'เชียงใหม่' })).id;
  southTechId = (await User.create({ username: 'southtech', password, fullName: 'South Tech', role: 'technician', province: 'สงขลา' })).id;
  northTechId = (await User.create({ username: 'northtech', password, fullName: 'North Tech', role: 'technician', province: 'เชียงใหม่' })).id;

  southSupToken = await login('southsup');
  northSupToken = await login('northsup');
  southTechToken = await login('southtech');
  northTechToken = await login('northtech');

  southOrderId = await createOrder(southTechToken, 'รพ.ใต้');
  northOrderId = await createOrder(northTechToken, 'รพ.เหนือ');
});

afterAll(async () => {
  try {
    await sequelize.drop();
  } catch (error) {
    // เหมือนเทสต์อื่น schema จะถูกสร้างใหม่ตอน sync force รอบถัดไปอยู่แล้ว
  }
  await sequelize.close();
});

describe('Southern supervisor region restriction', () => {
  test('southern supervisor lists only southern jobs', async () => {
    const res = await request(app).get('/api/work-orders/all').set('Authorization', `Bearer ${southSupToken}`);
    expect(res.status).toBe(200);
    expect(res.body.map((o) => o.customerName)).toEqual(['รพ.ใต้']);
  });

  test('other supervisors still list every job', async () => {
    const res = await request(app).get('/api/work-orders/all').set('Authorization', `Bearer ${northSupToken}`);
    expect(res.body).toHaveLength(2);
  });

  test('southern supervisor cannot open a non-southern job directly', async () => {
    const blocked = await request(app).get(`/api/work-orders/${northOrderId}`).set('Authorization', `Bearer ${southSupToken}`);
    expect(blocked.status).toBe(403);
    const allowed = await request(app).get(`/api/work-orders/${southOrderId}`).set('Authorization', `Bearer ${southSupToken}`);
    expect(allowed.status).toBe(200);
  });

  test('southern supervisor sees only southern users', async () => {
    const res = await request(app).get('/api/auth/users').set('Authorization', `Bearer ${southSupToken}`);
    expect(res.body.map((u) => u.username).sort()).toEqual(['southsup', 'southtech']);
  });

  test('southern supervisor gets approval notices only for southern jobs', async () => {
    const southNotes = await Notification.findAll({ where: { recipientId: southSupId } });
    expect(southNotes.map((n) => n.relatedWorkOrderId)).toEqual([southOrderId]);
    const northNotes = await Notification.findAll({ where: { recipientId: northSupId } });
    expect(northNotes).toHaveLength(2);
  });

  test('southern supervisor cannot approve a non-southern job', async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${northOrderId}/approve`)
      .set('Authorization', `Bearer ${southSupToken}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('not_authorized_region');
  });

  test('southern supervisor can still approve a southern job', async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${southOrderId}/approve`)
      .set('Authorization', `Bearer ${southSupToken}`)
      .send({});
    expect(res.status).toBe(200);
  });

  test('southern supervisor is blocked from every action on a non-southern job', async () => {
    const auth = { Authorization: `Bearer ${southSupToken}` };
    const base = `/api/work-orders/${northOrderId}`;
    const responses = await Promise.all([
      request(app).patch(`${base}/reschedule`).set(auth).send({ newDate: '2026-10-05', reason: 'ทดสอบ' }),
      request(app).patch(`${base}/cancel`).set(auth).send({ cancelReason: 'ทดสอบ' }),
      request(app).patch(`${base}/actual`).set(auth).send({ actualDate: '2026-10-01', actualDescription: 'ทดสอบ' }),
      request(app).patch(`${base}/photos`).set(auth).attach('photos', tinyPng, 'site.png'),
      request(app).delete(`${base}/photos`).set(auth).send({ photo: '/uploads/x.jpg' })
    ]);
    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('not_authorized_region');
    }
    const order = await WorkOrder.findByPk(northOrderId);
    expect(order.status).toBe('pending_approval');
  });

  test('overdue and cancelled lists are filtered for the southern supervisor', async () => {
    await WorkOrder.update({ status: 'overdue', isOverdue: true }, { where: {} });
    const overdue = await request(app).get('/api/work-orders/status/overdue').set('Authorization', `Bearer ${southSupToken}`);
    expect(overdue.body.map((o) => o.customerName)).toEqual(['รพ.ใต้']);

    await WorkOrder.update({ status: 'cancelled', cancelledAt: new Date() }, { where: {} });
    const cancelled = await request(app).get('/api/work-orders/status/cancelled').set('Authorization', `Bearer ${southSupToken}`);
    expect(cancelled.body.map((o) => o.customerName)).toEqual(['รพ.ใต้']);
    const cancelledAll = await request(app).get('/api/work-orders/status/cancelled').set('Authorization', `Bearer ${northSupToken}`);
    expect(cancelledAll.body).toHaveLength(2);
  });

  test('southern supervisor can assign MA visits only to southern technicians', async () => {
    const hospital = await Hospital.create({ name: 'รพ.สัญญา', address: 'ทดสอบ' });
    const contract = await Contract.create({
      hospitalId: hospital.id, contractNumber: 'C-REGION', startDate: '2026-01-01', endDate: '2026-12-31', maIntervalMonths: 6
    });
    const visit = await MaVisit.create({ contractId: contract.id, sequenceNo: 1, scheduledDate: '2026-11-01' });
    const auth = { Authorization: `Bearer ${southSupToken}` };
    const url = `/api/contracts/${contract.id}/visits/${visit.id}/assign`;

    const blocked = await request(app).post(url).set(auth).send({ technicianId: northTechId });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('not_authorized_region');

    const allowed = await request(app).post(url).set(auth).send({ technicianId: southTechId });
    expect(allowed.status).toBe(201);
  });

  test('reschedule and cancel by technicians notify only the right supervisors', async () => {
    await WorkOrder.update({ status: 'approved', isOverdue: false }, { where: {} });
    await request(app).patch(`/api/work-orders/${northOrderId}/reschedule`)
      .set('Authorization', `Bearer ${northTechToken}`).send({ newDate: '2026-10-09', reason: 'ทดสอบ' });
    await request(app).patch(`/api/work-orders/${northOrderId}/cancel`)
      .set('Authorization', `Bearer ${northTechToken}`).send({ cancelReason: 'ทดสอบ' });
    await request(app).patch(`/api/work-orders/${southOrderId}/cancel`)
      .set('Authorization', `Bearer ${southTechToken}`).send({ cancelReason: 'ทดสอบ' });

    const southNotes = await Notification.findAll({ where: { recipientId: southSupId } });
    const southRelated = await WorkOrder.findAll({ where: { id: southNotes.map((n) => n.relatedWorkOrderId) } });
    expect(southRelated.every((o) => o.technicianId === southTechId)).toBe(true);
    expect(southNotes.map((n) => n.type).sort()).toEqual(['approval_needed', 'approval_needed', 'cancelled']);

    const northNotes = await Notification.findAll({ where: { recipientId: northSupId } });
    expect(northNotes.map((n) => n.type).sort())
      .toEqual(['approval_needed', 'approval_needed', 'approval_needed', 'cancelled', 'cancelled', 'rescheduled']);

    // วันที่ต้องเก็บเป็น YYYY-MM-DD ล้วน ให้หน้าเว็บแสดงปีตามภาษาเอง
    const rescheduled = northNotes.find((n) => n.code === 'job_rescheduled');
    expect(rescheduled.data).toEqual({ srNumber: expect.any(String), fromDate: '2026-10-01', toDate: '2026-10-09', reason: 'ทดสอบ' });
    expect(northNotes.filter((n) => n.code === 'cancelled_by_technician')).toHaveLength(2);
  });

  test('overdue cron recipients skip the southern supervisor for non-southern jobs', async () => {
    const forNorth = await findSupervisorsToNotify(northTechId);
    expect(forNorth.map((u) => u.id)).toEqual([northSupId]);
    const forSouth = await findSupervisorsToNotify(southTechId);
    expect(forSouth.map((u) => u.id).sort()).toEqual([southSupId, northSupId].sort());
  });
});
