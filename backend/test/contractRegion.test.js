const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const { guessProvinceFromAddress } = require('../utils/provinceFromAddress');

let southSupToken, northSupToken, adminToken, southTechId;
let southHospitalId, northHospitalId, blankHospitalId;
let southContractId, northContractId;

const login = async (username) => {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'test123' });
  return res.body.token;
};

const createContract = (token, hospitalId, contractNumber) => request(app)
  .post('/api/contracts')
  .set('Authorization', `Bearer ${token}`)
  .send({ hospitalId, contractNumber, startDate: '2026-01-01', endDate: '2026-12-31', maIntervalMonths: 6 });

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const bcrypt = require('bcryptjs');
  const password = await bcrypt.hash('test123', await bcrypt.genSalt(10));
  await User.create({ username: 'southsup', password, fullName: 'South Sup', role: 'supervisor', province: 'สงขลา' });
  await User.create({ username: 'northsup', password, fullName: 'North Sup', role: 'supervisor', province: 'เชียงใหม่' });
  await User.create({ username: 'admin', password, fullName: 'Admin', role: 'admin', province: 'สงขลา' });
  southTechId = (await User.create({ username: 'southtech', password, fullName: 'South Tech', role: 'technician', province: 'สงขลา' })).id;
  southSupToken = await login('southsup');
  northSupToken = await login('northsup');
  adminToken = await login('admin');

  southHospitalId = (await request(app).post('/api/hospitals').set('Authorization', `Bearer ${southSupToken}`)
    .send({ name: 'รพ.ใต้', addressLine: '91 หมู่ 3', province: 'นครศรีธรรมราช', district: 'ขนอม', subdistrict: 'ขนอม' })).body._id;
  northHospitalId = (await request(app).post('/api/hospitals').set('Authorization', `Bearer ${northSupToken}`)
    .send({ name: 'รพ.เหนือ', province: 'เชียงใหม่', district: 'เมืองเชียงใหม่', subdistrict: 'ศรีภูมิ' })).body._id;
  blankHospitalId = (await Hospital.create({ name: 'รพ.ไม่มีจังหวัด', address: 'ไม่ทราบ' })).id;

  southContractId = (await createContract(northSupToken, southHospitalId, 'S-1')).body._id;
  northContractId = (await createContract(northSupToken, northHospitalId, 'N-1')).body._id;
  await createContract(northSupToken, blankHospitalId, 'B-1');
});

afterAll(async () => {
  try {
    await sequelize.drop();
  } catch (error) {
    // schema จะถูกสร้างใหม่ตอน sync force รอบถัดไปอยู่แล้ว
  }
  await sequelize.close();
});

describe('อ่านจังหวัดจากที่อยู่', () => {
  test('อ่านได้ทั้งแบบเต็ม แบบย่อ และแบบมีแค่ชื่อจังหวัด', () => {
    expect(guessProvinceFromAddress('198 หมู่ 7 อำเภอขามทะเลสอ จังหวัดนครราชสีมา')).toBe('นครราชสีมา');
    expect(guessProvinceFromAddress('91 ต.ขนอม อ.ขนอม จ.นครศรีธรรมราช')).toBe('นครศรีธรรมราช');
    expect(guessProvinceFromAddress('ตรัง')).toBe('ตรัง');
    expect(guessProvinceFromAddress('ต.ตากใบ อ.ตากใบ จ.นราธิวาส')).toBe('นราธิวาส');
    expect(guessProvinceFromAddress('ไม่ทราบ')).toBeNull();
  });

  test('โรงพยาบาลที่เพิ่มได้ภาค รหัสไปรษณีย์ และที่อยู่เต็มที่รวมให้', async () => {
    const hospital = await Hospital.findByPk(southHospitalId);
    expect(hospital).toMatchObject({
      province: 'นครศรีธรรมราช', region: 'ใต้', postalCode: '80210',
      address: '91 หมู่ 3 ตำบลขนอม อำเภอขนอม จังหวัดนครศรีธรรมราช 80210'
    });
  });

  test('กรุงเทพใช้แขวงกับเขต', async () => {
    const res = await request(app).post('/api/hospitals').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'รพ.กทม', addressLine: '99 ถนนพหลโยธิน', province: 'กรุงเทพมหานคร', district: 'จตุจักร', subdistrict: 'ลาดยาว' });
    expect(res.status).toBe(201);
    expect(res.body.address).toBe('99 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพมหานคร 10900');
  });

  test('ตำบลที่ไม่อยู่ในอำเภอนั้นถูกปฏิเสธ และต้องเลือกให้ครบ', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const wrong = await request(app).post('/api/hospitals').set(auth)
      .send({ name: 'รพ.ผิด', province: 'นครศรีธรรมราช', district: 'ขนอม', subdistrict: 'ลาดยาว' });
    expect(wrong.body.code).toBe('hospital_location_invalid');
    const missing = await request(app).post('/api/hospitals').set(auth).send({ name: 'รพ.ไม่ครบ', province: 'ตรัง' });
    expect(missing.body.code).toBe('hospital_fields_required');
  });

  test('แยกที่อยู่เดิมของโรงพยาบาลเก่าได้ โดยไม่แก้ที่อยู่เต็ม', async () => {
    const old = await Hospital.create({ name: 'รพ.เก่า', address: '198 หมู่ 7 ถนนโคกกรวด-โนนไทย ตำบลขามทะเลสอ อำเภอขามทะเลสอ จังหวัดนครราชสีมา' });
    await Hospital.backfillAddresses();
    await old.reload();
    expect(old).toMatchObject({
      province: 'นครราชสีมา', district: 'ขามทะเลสอ', subdistrict: 'ขามทะเลสอ', postalCode: '30280',
      addressLine: '198 หมู่ 7 ถนนโคกกรวด-โนนไทย',
      address: '198 หมู่ 7 ถนนโคกกรวด-โนนไทย ตำบลขามทะเลสอ อำเภอขามทะเลสอ จังหวัดนครราชสีมา'
    });
  });
});

describe('จำกัดหน้าสัญญาสำหรับหัวหน้าภาคใต้', () => {
  test('หัวหน้าภาคใต้เห็นแค่สัญญาของโรงพยาบาลภาคใต้', async () => {
    const res = await request(app).get('/api/contracts').set('Authorization', `Bearer ${southSupToken}`);
    expect(res.body.map((c) => c.contractNumber)).toEqual(['S-1']);
  });

  test('หัวหน้าภาคอื่นและ admin เห็นทุกสัญญา', async () => {
    for (const token of [northSupToken, adminToken]) {
      const res = await request(app).get('/api/contracts').set('Authorization', `Bearer ${token}`);
      expect(res.body).toHaveLength(3);
    }
  });

  test('หัวหน้าภาคใต้ทำอะไรกับสัญญาภาคอื่นไม่ได้เลย', async () => {
    const auth = { Authorization: `Bearer ${southSupToken}` };
    const visits = await request(app).get(`/api/contracts/${northContractId}/visits`).set('Authorization', `Bearer ${northSupToken}`);
    const visitId = visits.body[0]._id || visits.body[0].id;
    const base = `/api/contracts/${northContractId}`;
    const responses = await Promise.all([
      request(app).get(`${base}/visits`).set(auth),
      request(app).patch(`${base}/visits/${visitId}`).set(auth).send({ scheduledDate: '2026-02-02' }),
      request(app).post(`${base}/visits/${visitId}/assign`).set(auth).send({ technicianId: southTechId }),
      request(app).patch(base).set(auth).send({ hospitalId: northHospitalId, contractNumber: 'N-1x', startDate: '2026-01-01', endDate: '2026-12-31', maIntervalMonths: 6 }),
      createContract(southSupToken, northHospitalId, 'N-2'),
      createContract(southSupToken, blankHospitalId, 'B-2')
    ]);
    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('not_authorized_region');
    }
  });

  test('หัวหน้าภาคใต้ย้ายสัญญาภาคใต้ไปโรงพยาบาลภาคอื่นไม่ได้', async () => {
    const res = await request(app).patch(`/api/contracts/${southContractId}`).set('Authorization', `Bearer ${southSupToken}`)
      .send({ hospitalId: northHospitalId, contractNumber: 'S-1', startDate: '2026-01-01', endDate: '2026-12-31', maIntervalMonths: 6 });
    expect(res.status).toBe(403);
  });

  test('หัวหน้าภาคใต้ยังจัดการสัญญาภาคใต้ได้ปกติ', async () => {
    const auth = { Authorization: `Bearer ${southSupToken}` };
    const visits = await request(app).get(`/api/contracts/${southContractId}/visits`).set(auth);
    expect(visits.status).toBe(200);
    const visitId = visits.body[0]._id || visits.body[0].id;
    const assigned = await request(app).post(`/api/contracts/${southContractId}/visits/${visitId}/assign`).set(auth).send({ technicianId: southTechId });
    expect(assigned.status).toBe(201);
    const created = await createContract(southSupToken, southHospitalId, 'S-2');
    expect(created.status).toBe(201);
  });
});

describe('จำกัดหน้าโรงพยาบาลสำหรับหัวหน้าภาคใต้', () => {
  const northBody = { name: 'รพ.เหนือ 2', province: 'เชียงใหม่', district: 'เมืองเชียงใหม่', subdistrict: 'ศรีภูมิ' };

  test('หัวหน้าภาคใต้เห็นแค่โรงพยาบาลภาคใต้ ทั้งรายการและการค้นหา', async () => {
    const auth = { Authorization: `Bearer ${southSupToken}` };
    const all = await request(app).get('/api/hospitals?limit=1000').set(auth);
    expect(all.body.every((h) => h.region === 'ใต้')).toBe(true);
    expect(all.body.map((h) => h.name)).toContain('รพ.ใต้');
    const search = await request(app).get('/api/hospitals').query({ search: 'เหนือ' }).set(auth);
    expect(search.body).toHaveLength(0);
  });

  test('หัวหน้าภาคอื่นยังเห็นทุกโรงพยาบาล', async () => {
    const res = await request(app).get('/api/hospitals?limit=1000').set('Authorization', `Bearer ${northSupToken}`);
    expect(res.body.map((h) => h.name)).toEqual(expect.arrayContaining(['รพ.ใต้', 'รพ.เหนือ', 'รพ.ไม่มีจังหวัด']));
  });

  test('หัวหน้าภาคใต้เพิ่ม แก้ ลบ โรงพยาบาลภาคอื่นไม่ได้ และย้ายโรงพยาบาลภาคใต้ไปภาคอื่นไม่ได้', async () => {
    const auth = { Authorization: `Bearer ${southSupToken}` };
    const southBody = { name: 'รพ.ใต้', addressLine: '91 หมู่ 3', province: 'นครศรีธรรมราช', district: 'ขนอม', subdistrict: 'ขนอม' };
    const responses = await Promise.all([
      request(app).post('/api/hospitals').set(auth).send(northBody),
      request(app).patch(`/api/hospitals/${northHospitalId}`).set(auth).send({ ...northBody, name: 'รพ.เหนือ' }),
      request(app).delete(`/api/hospitals/${blankHospitalId}`).set(auth),
      request(app).patch(`/api/hospitals/${southHospitalId}`).set(auth).send({ ...northBody, name: 'รพ.ใต้' })
    ]);
    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('not_authorized_region');
    }
    const ok = await request(app).patch(`/api/hospitals/${southHospitalId}`).set(auth).send({ ...southBody, addressLine: '92 หมู่ 3' });
    expect(ok.status).toBe(200);
  });
});
