const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../config/database');
const User = require('../models/User');

let supToken, techToken, techId;

const login = async (username) => {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'test123' });
  return res.body.token;
};

const history = async (query = '') => {
  const res = await request(app).get(`/api/audit-logs${query}`).set('Authorization', `Bearer ${supToken}`);
  return res.body;
};

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const bcrypt = require('bcryptjs');
  const password = await bcrypt.hash('test123', await bcrypt.genSalt(10));
  await User.create({ username: 'audit_sup', password, fullName: 'Audit Sup', role: 'supervisor' });
  techId = (await User.create({ username: 'audit_tech', password, fullName: 'Audit Tech', role: 'technician' })).id;
  supToken = await login('audit_sup');
  techToken = await login('audit_tech');
});

afterAll(async () => {
  try {
    await sequelize.drop();
  } catch (error) {
    // เหมือนเทสต์อื่น schema จะถูกสร้างใหม่ตอน sync force รอบถัดไปอยู่แล้ว
  }
  await sequelize.close();
});

describe('Audit log for hospitals and contracts', () => {
  let hospitalId, contractId;

  test('records who added, edited and deleted a hospital with only the changed fields', async () => {
    const auth = { Authorization: `Bearer ${supToken}` };
    const created = await request(app).post('/api/hospitals').set(auth).send({ name: 'รพ.ก', address: 'ที่อยู่เดิม' });
    hospitalId = created.body._id;

    // บันทึกซ้ำโดยไม่เปลี่ยนอะไร ต้องไม่เกิดประวัติ
    await request(app).patch(`/api/hospitals/${hospitalId}`).set(auth).send({ name: 'รพ.ก', address: 'ที่อยู่เดิม' });
    await request(app).patch(`/api/hospitals/${hospitalId}`).set(auth).send({ name: 'รพ.ก', address: 'ที่อยู่ใหม่' });

    const temp = await request(app).post('/api/hospitals').set(auth).send({ name: 'รพ.ลบ', address: 'x' });
    await request(app).delete(`/api/hospitals/${temp.body._id}`).set(auth);

    const { items, total } = await history('?entityType=hospital');
    expect(total).toBe(4);
    expect(items.map((i) => i.action)).toEqual(['delete', 'create', 'update', 'create']);
    expect(items[2].changes).toEqual([{ field: 'address', from: 'ที่อยู่เดิม', to: 'ที่อยู่ใหม่' }]);
    expect(items[0]).toMatchObject({ entityLabel: 'รพ.ลบ', actorName: 'Audit Sup' });
  });

  test('records contract changes, MA visit date moves and technician assignment', async () => {
    const auth = { Authorization: `Bearer ${supToken}` };
    const body = { hospitalId, contractNumber: 'C-1', startDate: '2026-01-01', endDate: '2026-12-31', maIntervalMonths: 6 };
    const createdContract = (await request(app).post('/api/contracts').set(auth).send(body)).body;
    contractId = createdContract._id;
    expect(createdContract.createdByName).toBe('Audit Sup');
    await request(app).patch(`/api/contracts/${contractId}`).set(auth).send({ ...body, contractNumber: 'C-2' });

    const visits = (await request(app).get(`/api/contracts/${contractId}/visits`).set(auth)).body;
    const visit = visits.find((v) => !v.workOrder);
    await request(app).patch(`/api/contracts/${contractId}/visits/${visit._id}`).set(auth).send({ scheduledDate: '2026-08-15' });
    await request(app).post(`/api/contracts/${contractId}/visits/${visit._id}/assign`).set(auth).send({ technicianId: techId });

    const { items } = await history('?entityType=contract');
    expect(items).toHaveLength(4);
    expect(items[0].changes[0]).toMatchObject({ field: 'maVisitTechnician', seq: visit.sequenceNo });
    expect(items[0].changes[0].to).toContain('Audit Tech');
    expect(items[1].changes[0]).toMatchObject({ field: 'maVisitDate', to: '2026-08-15' });
    expect(items[2].changes).toEqual([{ field: 'contractNumber', from: 'C-1', to: 'C-2' }]);
    expect(items[3]).toMatchObject({ action: 'create', entityLabel: 'C-1 (รพ.ก)' });
  });

  test('search matches item name or who made the change', async () => {
    expect((await history('?search=C-2')).total).toBe(3);
    expect((await history('?search=Audit Sup')).total).toBe(8);
  });

  test('technicians cannot read the history', async () => {
    const res = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${techToken}`);
    expect(res.status).toBe(403);
  });
});
