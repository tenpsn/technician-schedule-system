const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const WorkOrder = require('../models/WorkOrder');

let supToken, techToken, techId;

const login = async (username) => {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'test123' });
  return res.body.token;
};

// สร้างงาน อนุมัติ แล้วให้ช่างบันทึกงานจริงหนึ่งครั้ง ได้งานที่มี Actual รอตรวจรับ
const createJobWithActual = async () => {
  const created = await request(app)
    .post('/api/work-orders')
    .set('Authorization', `Bearer ${techToken}`)
    .send({ customerName: 'รพ.ทดสอบ', customerLocation: 'ทดสอบ', workType: 'MA', plannedDate: '2026-10-01', plannedStartTime: '09:00', plannedEndTime: '12:00' });
  const id = created.body._id;
  await request(app).patch(`/api/work-orders/${id}/approve`).set('Authorization', `Bearer ${supToken}`).send({});
  await request(app).patch(`/api/work-orders/${id}/actual`).set('Authorization', `Bearer ${techToken}`)
    .send({ actualDate: '2026-10-01', actualDescription: 'ทำแล้ว' });
  return { id, srNumber: created.body.srNumber };
};

const reject = (id, index = 0) => request(app)
  .patch(`/api/work-orders/${id}/actual/${index}/reject`)
  .set('Authorization', `Bearer ${supToken}`)
  .send({ plannedDate: '2026-10-10', plannedStartTime: '13:00', plannedEndTime: '15:00', description: 'เครื่องยังมีเสียงดัง' });

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const bcrypt = require('bcryptjs');
  const password = await bcrypt.hash('test123', await bcrypt.genSalt(10));
  await User.create({ username: 'sup', password, fullName: 'Sup', role: 'supervisor', province: 'เชียงใหม่' });
  techId = (await User.create({ username: 'tech', password, fullName: 'Tech', role: 'technician', province: 'เชียงใหม่' })).id;
  supToken = await login('sup');
  techToken = await login('tech');
});

afterAll(async () => {
  try {
    await sequelize.drop();
  } catch (error) {
    // schema จะถูกสร้างใหม่ตอน sync force รอบถัดไปอยู่แล้ว
  }
  await sequelize.close();
});

describe('ตรวจรับบันทึกงานจริง', () => {
  test('ช่างบันทึกแล้วรอตรวจรับ หัวหน้ากดผ่านได้ครั้งเดียว', async () => {
    const { id } = await createJobWithActual();
    const before = await WorkOrder.findByPk(id);
    expect(before.actualLog[0].verifiedAt).toBeNull();

    const res = await request(app).patch(`/api/work-orders/${id}/actual/0/verify`).set('Authorization', `Bearer ${supToken}`);
    expect(res.status).toBe(200);
    expect(res.body.actualLog[0].verifyResult).toBe('passed');

    const again = await request(app).patch(`/api/work-orders/${id}/actual/0/verify`).set('Authorization', `Bearer ${supToken}`);
    expect(again.body.code).toBe('actual_log_already_verified');
  });

  test('ช่างกดตรวจรับเองไม่ได้', async () => {
    const { id } = await createJobWithActual();
    const res = await request(app).patch(`/api/work-orders/${id}/actual/0/verify`).set('Authorization', `Bearer ${techToken}`);
    expect(res.status).toBe(403);
  });

  test('ไม่ผ่านแล้วสร้างงานต่อเลข SR เดิมเติม 2 อนุมัติแล้ว และงานเดิมเสร็จสิ้น', async () => {
    const { id, srNumber } = await createJobWithActual();
    const res = await reject(id);
    expect(res.status).toBe(200);
    expect(res.body.followUp.srNumber).toBe(`${srNumber}-2`);
    expect(res.body.order.status).toBe('completed');
    expect(res.body.order.actualLog[0]).toMatchObject({ verifyResult: 'rejected', followUpSrNumber: `${srNumber}-2` });

    const followUp = await WorkOrder.findByPk(res.body.followUp._id);
    expect(followUp).toMatchObject({
      status: 'approved', technicianId: techId, description: 'เครื่องยังมีเสียงดัง',
      plannedStartTime: '13:00', plannedEndTime: '15:00', parentWorkOrderId: id, parentSrNumber: srNumber
    });
    expect(followUp.approvalHistory).toHaveLength(1);
  });

  test('งานต่อไม่ผ่านอีกได้เลขลำดับถัดไปจากเลขต้นทาง และเลขงานใหม่ไม่สะดุด', async () => {
    const { id, srNumber } = await createJobWithActual();
    const first = await reject(id);
    const followUpId = first.body.followUp._id;
    await request(app).patch(`/api/work-orders/${followUpId}/actual`).set('Authorization', `Bearer ${techToken}`)
      .send({ actualDate: '2026-10-10', actualDescription: 'ทำอีกรอบ' });
    const second = await reject(followUpId);
    expect(second.body.followUp.srNumber).toBe(`${srNumber}-3`);

    const next = await request(app).post('/api/work-orders').set('Authorization', `Bearer ${techToken}`)
      .send({ customerName: 'รพ.ใหม่', customerLocation: 'ทดสอบ', workType: 'MA', plannedDate: '2026-10-01' });
    expect(next.status).toBe(201);
    expect(next.body.srNumber).toMatch(/^SR-\d{6}-\d{4}$/);
  });

  test('ไม่ผ่านต้องใส่วันที่และรายละเอียด', async () => {
    const { id } = await createJobWithActual();
    const res = await request(app).patch(`/api/work-orders/${id}/actual/0/reject`)
      .set('Authorization', `Bearer ${supToken}`).send({ plannedDate: '2026-10-10' });
    expect(res.body.code).toBe('reject_fields_required');
  });
});
