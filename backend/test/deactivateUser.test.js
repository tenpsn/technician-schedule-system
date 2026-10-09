const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../config/database');
const User = require('../models/User');

let adminToken, techId;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const bcrypt = require('bcryptjs');
  const password = await bcrypt.hash('test123', await bcrypt.genSalt(10));

  await User.create({ username: 'admin1', password, fullName: 'Admin One', role: 'admin', province: 'กรุงเทพมหานคร' });
  techId = (await User.create({ username: 'tech1', password, fullName: 'Tech One', role: 'technician', province: 'กรุงเทพมหานคร' })).id;

  const res = await request(app).post('/api/auth/login').send({ username: 'admin1', password: 'test123' });
  adminToken = res.body.token;
});

afterAll(async () => {
  try {
    await sequelize.drop();
  } catch (error) {
    // schema จะถูกสร้างใหม่ตอน sync force รอบถัดไปอยู่แล้ว
  }
});

const patchUser = (body) => request(app)
  .patch(`/api/auth/users/${techId}`)
  .set('Authorization', `Bearer ${adminToken}`)
  .send(body);

describe('ปิดใช้งานผู้ใช้ต้องมีเหตุผล', () => {
  test('ไม่ใส่เหตุผลจะถูกปฏิเสธ', async () => {
    const res = await patchUser({ active: false, reason: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('deactivate_reason_required');
    expect((await User.findByPk(techId)).active).toBe(true);
  });

  test('ใส่เหตุผลแล้วบันทึกเหตุผล เวลา และชื่อคนปิด', async () => {
    const res = await patchUser({ active: false, reason: 'ลาออก' });
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
    expect(res.body.deactivatedReason).toBe('ลาออก');
    expect(res.body.deactivatedBy).toBe('Admin One');
    expect(res.body.deactivatedAt).toBeTruthy();
  });

  test('เปิดใช้งานโดยไม่ใส่เหตุผลจะถูกปฏิเสธ', async () => {
    const res = await patchUser({ active: true });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('activate_reason_required');
    expect((await User.findByPk(techId)).active).toBe(false);
  });

  test('เปิดใช้งานพร้อมเหตุผลจะบันทึกข้อมูลการเปิดและล้างข้อมูลการปิด', async () => {
    const res = await patchUser({ active: true, reason: 'กลับมาทำงาน' });
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
    expect(res.body.reactivatedReason).toBe('กลับมาทำงาน');
    expect(res.body.reactivatedBy).toBe('Admin One');
    expect(res.body.reactivatedAt).toBeTruthy();
    expect(res.body.deactivatedReason).toBeNull();
    expect(res.body.deactivatedAt).toBeNull();
    expect(res.body.deactivatedBy).toBeNull();
  });
});

describe('ประวัติบัญชีผู้ใช้', () => {
  test('เก็บประวัติเพิ่ม แก้ไข ปิด และเปิดใช้งาน', async () => {
    const created = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'tech2', password: 'test123', fullName: 'Tech Two', role: 'technician', province: 'กรุงเทพมหานคร' });
    const id = created.body._id;
    const patch = (body) => request(app).patch(`/api/auth/users/${id}`).set('Authorization', `Bearer ${adminToken}`).send(body);
    await patch({ role: 'supervisor' });
    await patch({ active: false, reason: 'ย้ายแผนก' });
    await patch({ active: true, reason: 'ย้ายกลับ' });

    const res = await request(app)
      .get('/api/audit-logs?entityType=user&search=tech2')
      .set('Authorization', `Bearer ${adminToken}`);
    // เวลาอาจซ้ำกันในระดับมิลลิวินาที จึงไม่เช็คลำดับ
    const actions = res.body.items.map((l) => l.action).sort();
    expect(actions).toEqual(['activate', 'create', 'deactivate', 'update']);

    const update = res.body.items.find((l) => l.action === 'update');
    expect(update.changes).toEqual([{ field: 'role', from: 'technician', to: 'supervisor' }]);
    const deactivate = res.body.items.find((l) => l.action === 'deactivate');
    expect(deactivate.changes[0].to).toBe('ย้ายแผนก');
    expect(deactivate.actorName).toBe('Admin One');
    const activate = res.body.items.find((l) => l.action === 'activate');
    expect(activate.changes).toEqual([{ field: 'reactivatedReason', from: null, to: 'ย้ายกลับ' }]);
  });

  test('หัวหน้างานที่ไม่ใช่ admin เปิดหน้าประวัติไม่ได้', async () => {
    const bcrypt = require('bcryptjs');
    const password = await bcrypt.hash('test123', await bcrypt.genSalt(10));
    await User.create({ username: 'sup1', password, fullName: 'Sup One', role: 'supervisor', province: 'กรุงเทพมหานคร' });
    const token = (await request(app).post('/api/auth/login').send({ username: 'sup1', password: 'test123' })).body.token;

    const res = await request(app).get('/api/audit-logs?entityType=user').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('รูปโปรไฟล์ในประวัติ', () => {
  test('ประวัติส่งรูปของผู้ทำและผู้ใช้ที่ถูกแก้มาด้วย', async () => {
    await User.update({ avatarUrl: '/uploads/avatars/admin.jpg' }, { where: { username: 'admin1' } });
    await User.update({ avatarUrl: '/uploads/avatars/tech1.jpg' }, { where: { id: techId } });

    const res = await request(app)
      .get('/api/audit-logs?entityType=user&search=tech1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const log of res.body.items) {
      expect(log.actor.avatarUrl).toBe('/uploads/avatars/admin.jpg');
      expect(log.subjectUser.avatarUrl).toBe('/uploads/avatars/tech1.jpg');
    }
  });

  test('ประวัติโรงพยาบาลไม่มีรูปผู้ใช้ที่ถูกแก้', async () => {
    await request(app).post('/api/hospitals').set('Authorization', `Bearer ${adminToken}`).send({ name: 'รพ.ทดสอบรูป', address: 'ที่อยู่' });
    const res = await request(app).get('/api/audit-logs?entityType=hospital').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.items[0].subjectUser).toBeNull();
    expect(res.body.items[0].actor.avatarUrl).toBe('/uploads/avatars/admin.jpg');
  });
});
