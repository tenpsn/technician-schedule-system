const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../config/database');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');

let techToken, supToken;
let techId, supId;
let testOrderId;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('test123', salt);

  // Create technician
  const tech = await User.create({
    username: 'testtech2',
    password: hashedPassword,
    fullName: 'Test Tech 2',
    role: 'technician'
  });
  techId = tech.id;

  // Create supervisor
  const sup = await User.create({
    username: 'testsup2',
    password: hashedPassword,
    fullName: 'Test Supervisor',
    role: 'supervisor'
  });
  supId = sup.id;
  
  // Login technician
  const techRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testtech2', password: 'test123' });
  techToken = techRes.body.token;
  
  // Login supervisor
  const supRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testsup2', password: 'test123' });
  supToken = supRes.body.token;
  
  // Create test work order
  const orderRes = await request(app)
    .post('/api/work-orders')
    .set('Authorization', `Bearer ${techToken}`)
    .send({
      customerName: 'รพ.ทดสอบ',
      customerLocation: 'ทดสอบ',
      workType: 'MA',
      plannedDate: '2026-10-01'
    });
  testOrderId = orderRes.body._id;
});

afterAll(async () => {
  try {
    await sequelize.drop();
  } catch (error) {
    // sequelize.drop() has a known dialect quirk on some pg/sequelize
    // version combos; the schema gets recreated via sync({force:true})
    // on the next run regardless, so a failure here is harmless.
  }
  await sequelize.close();
});

describe('Cancel Work Order API', () => {
  test('should cancel work order as owner', async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${testOrderId}/cancel`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({ cancelReason: 'ลูกค้าขอยกเลิกเนื่องจากเปลี่ยนผู้ให้บริการ' });
    
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('cancelled');
    expect(res.body.order.cancelReason).toBe('ลูกค้าขอยกเลิกเนื่องจากเปลี่ยนผู้ให้บริการ');
    expect(res.body.order.cancelledBy).toBeTruthy();
  });

  test('should not cancel without reason', async () => {
    // Create new order
    const orderRes = await request(app)
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        customerName: 'รพ.ทดสอบ2',
        customerLocation: 'ทดสอบ',
        workType: 'MA',
        plannedDate: '2026-10-02'
      });
    
    const res = await request(app)
      .patch(`/api/work-orders/${orderRes.body._id}/cancel`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({ cancelReason: '' });
    
    expect(res.status).toBe(400);
  });

  test('should cancel with a short (but non-empty) reason', async () => {
    const orderRes = await request(app)
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        customerName: 'รพ.ทดสอบ3',
        customerLocation: 'ทดสอบ',
        workType: 'MA',
        plannedDate: '2026-10-03'
      });

    const res = await request(app)
      .patch(`/api/work-orders/${orderRes.body._id}/cancel`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({ cancelReason: 'สั้นไป' });

    expect(res.status).toBe(200);
  });

  test('should cancel as supervisor for any order', async () => {
    const orderRes = await request(app)
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        customerName: 'รพ.ทดสอบ4',
        customerLocation: 'ทดสอบ',
        workType: 'MA',
        plannedDate: '2026-10-04'
      });
    
    const res = await request(app)
      .patch(`/api/work-orders/${orderRes.body._id}/cancel`)
      .set('Authorization', `Bearer ${supToken}`)
      .send({ cancelReason: 'หัวหน้าสั่งยกเลิกเนื่องจากนโยบายใหม่' });
    
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('cancelled');
  });

  test('should not cancel completed order', async () => {
    // Create and complete an order
    const orderRes = await request(app)
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        customerName: 'รพ.ทดสอบ5',
        customerLocation: 'ทดสอบ',
        workType: 'MA',
        plannedDate: '2026-09-01'
      });
    
    // Approve first
    await request(app)
      .patch(`/api/work-orders/${orderRes.body._id}/approve`)
      .set('Authorization', `Bearer ${supToken}`);
    
    // Complete
    await request(app)
      .patch(`/api/work-orders/${orderRes.body._id}/actual`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        actualDate: '2026-09-01',
        actualDescription: 'ทำงานเสร็จแล้ว'
      });
    
    // Try to cancel
    const res = await request(app)
      .patch(`/api/work-orders/${orderRes.body._id}/cancel`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({ cancelReason: 'ต้องการยกเลิก' });
    
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('cannot_cancel_status');
    expect(res.body.data).toEqual({ status: 'completed' });
  });
});
