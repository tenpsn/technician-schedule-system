const bcrypt = require('bcryptjs');
require('dotenv').config();
const { sequelize } = require('./config/database');
const User = require('./models/User');
const WorkOrder = require('./models/WorkOrder');
const Hospital = require('./models/Hospital');
const HOSPITAL_SEED_DATA = require('./data/hospitalSeedData');

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL Connected');

    // รีเซ็ตสคีมาฐานข้อมูลใหม่ทั้งหมด
    await sequelize.sync({ force: true });
    console.log('🗑️  Cleared existing data');

    // สร้างผู้ใช้
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    const users = await User.bulkCreate([
      {
        username: 'admin',
        password: hashedPassword,
        fullName: 'ผู้ดูแลระบบ',
        role: 'admin',
        email: 'admin@gd4.com',
        phone: '081-234-5678'
      },
      {
        username: 'supervisor',
        password: hashedPassword,
        fullName: 'หัวหน้าช่าง',
        role: 'supervisor',
        email: 'sup@gd4.com',
        phone: '082-345-6789'
      },
      {
        username: 'somchai',
        password: hashedPassword,
        fullName: 'สมชาย ใจดี',
        role: 'technician',
        email: 'somchai@gd4.com',
        phone: '083-456-7890'
      },
      {
        username: 'somchai_dit',
        password: hashedPassword,
        fullName: 'สมชาย (ติดตั้ง DR)',
        role: 'technician',
        email: 'somchai.dr@gd4.com',
        phone: '084-567-8901'
      },
      {
        username: 'bunsong',
        password: hashedPassword,
        fullName: 'บุญสูง',
        role: 'technician',
        email: 'bunsong@gd4.com',
        phone: '085-678-9012'
      },
      {
        username: 'kong',
        password: hashedPassword,
        fullName: 'คง',
        role: 'technician',
        email: 'kong@gd4.com',
        phone: '086-789-0123'
      },
      {
        username: 'suda',
        password: hashedPassword,
        fullName: 'สุดา',
        role: 'technician',
        email: 'suda@gd4.com',
        phone: '087-890-1234'
      },
      {
        username: 'prayai',
        password: hashedPassword,
        fullName: 'ประทาย',
        role: 'technician',
        email: 'prayai@gd4.com',
        phone: '088-901-2345'
      }
    ]);

    console.log(`✅ Created ${users.length} users`);

    // สร้างใบงานตัวอย่าง plannedDate เก็บเป็น UTC midnight ของวันที่ต้องการ ดูรายละเอียดที่ overdueCalc.js
    // สร้างจาก now ของเครื่องนี้เพื่อให้ตรงวันตามเวลาท้องถิ่น ไม่ฝังเวลาปัจจุบันลงไปในค่าที่เก็บ
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const tomorrow = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1));

    const workOrders = await WorkOrder.bulkCreate([
      {
        srNumber: 'SR-202609-0001',
        technicianId: users[2].id, // สมชาย
        customerName: 'รพ.สูงเนิน',
        customerLocation: 'สูงเนิน โคราช',
        workType: 'ติดตั้ง',
        description: 'ติดตั้งระบบ DR',
        plannedDate: tomorrow,
        plannedStartTime: '09:00',
        plannedEndTime: '17:00',
        status: 'pending_approval'
      },
      {
        srNumber: 'SR-202609-0002',
        technicianId: users[4].id, // บุญสูง
        customerName: 'รพ.โนนสูง',
        customerLocation: 'โนนสูง โคราช',
        workType: 'MA',
        description: 'บำรุงรักษาประจำเดือน',
        plannedDate: today,
        plannedStartTime: '08:30',
        plannedEndTime: '12:00',
        status: 'approved',
        approvedById: users[1].id,
        approvedAt: new Date()
      }
    ]);

    console.log(`✅ Created ${workOrders.length} sample work orders`);

    const hospitals = await Hospital.bulkCreate(HOSPITAL_SEED_DATA);
    console.log(`✅ Created ${hospitals.length} hospitals`);

    console.log('\n📋 Test Accounts:');
    console.log('  Username: admin        | Password: password123');
    console.log('  Username: supervisor   | Password: password123');
    console.log('  Username: somchai      | Password: password123');
    console.log('  Username: bunsong      | Password: password123');
    console.log('\n✅ Seed completed successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seed();
