const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../config/database');
const User = require('../models/User');

let techToken, otherTechToken, supToken;
let testOrderId;

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('test123', salt);

  await User.create({ username: 'phototech', password: hashedPassword, fullName: 'Photo Tech', role: 'technician' });
  await User.create({ username: 'othertech', password: hashedPassword, fullName: 'Other Tech', role: 'technician' });
  await User.create({ username: 'photosup', password: hashedPassword, fullName: 'Photo Supervisor', role: 'supervisor' });

  const techRes = await request(app).post('/api/auth/login').send({ username: 'phototech', password: 'test123' });
  techToken = techRes.body.token;

  const otherRes = await request(app).post('/api/auth/login').send({ username: 'othertech', password: 'test123' });
  otherTechToken = otherRes.body.token;

  const supRes = await request(app).post('/api/auth/login').send({ username: 'photosup', password: 'test123' });
  supToken = supRes.body.token;

  const orderRes = await request(app)
    .post('/api/work-orders')
    .set('Authorization', `Bearer ${techToken}`)
    .send({
      customerName: 'รพ.ทดสอบรูป',
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
    // known dialect quirk, harmless — see cancelWorkOrder.test.js
  }
  await sequelize.close();
});

describe('Upload Work Order Photos API', () => {
  test('should upload photos as owner', async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${testOrderId}/photos`)
      .set('Authorization', `Bearer ${techToken}`)
      .attach('photos', tinyPng, 'site.png');

    expect(res.status).toBe(200);
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0]).toContain(`/uploads/work-orders/${testOrderId}/`);
  });

  test('should reject upload with no files attached', async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${testOrderId}/photos`)
      .set('Authorization', `Bearer ${techToken}`);

    expect(res.status).toBe(400);
  });

  test('should reject non-image files', async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${testOrderId}/photos`)
      .set('Authorization', `Bearer ${techToken}`)
      .attach('photos', Buffer.from('not an image'), 'notes.txt');

    expect(res.status).toBe(400);
  });

  test('should not allow a non-owner technician to upload', async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${testOrderId}/photos`)
      .set('Authorization', `Bearer ${otherTechToken}`)
      .attach('photos', tinyPng, 'site.png');

    expect(res.status).toBe(403);
  });

  test('should allow a supervisor to upload', async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${testOrderId}/photos`)
      .set('Authorization', `Bearer ${supToken}`)
      .attach('photos', tinyPng, 'site2.png');

    expect(res.status).toBe(200);
    expect(res.body.photos).toHaveLength(2);
  });
});

describe('Delete Work Order Photo API', () => {
  test('should not allow a non-owner technician to delete', async () => {
    const order = await request(app)
      .get(`/api/work-orders/${testOrderId}`)
      .set('Authorization', `Bearer ${techToken}`);
    const [photo] = order.body.photos;

    const res = await request(app)
      .delete(`/api/work-orders/${testOrderId}/photos`)
      .set('Authorization', `Bearer ${otherTechToken}`)
      .send({ photo });

    expect(res.status).toBe(403);
  });

  test('should reject deleting a photo that is not on the order', async () => {
    const res = await request(app)
      .delete(`/api/work-orders/${testOrderId}/photos`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({ photo: '/uploads/work-orders/does-not-exist.png' });

    expect(res.status).toBe(400);
  });

  test('should delete a photo as owner', async () => {
    const order = await request(app)
      .get(`/api/work-orders/${testOrderId}`)
      .set('Authorization', `Bearer ${techToken}`);
    const [photo] = order.body.photos;

    const res = await request(app)
      .delete(`/api/work-orders/${testOrderId}/photos`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({ photo });

    expect(res.status).toBe(200);
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos).not.toContain(photo);
  });
});
