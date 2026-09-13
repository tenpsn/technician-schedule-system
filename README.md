# ระบบจัดการตารางงานแผนกช่าง (Technician Schedule Management System)

ระบบเว็บสำหรับจัดการตารางงานของช่าง แต่ละคนสามารถวางแผนงาน (Planning) รายสัปดาห์ บันทึกงานจริง (Actual)
เมื่อถึงวันงาน หัวหน้างานอนุมัติแผนงาน ระบบติดตามงานค้าง (Overdue) แจ้งเตือนอัตโนมัติ พร้อมฟีเจอร์
ยกเลิกงานพร้อมเหตุผลและรายงานสรุป ใช้งานได้ทั้งบนโน้ตบุ๊กและมือถือ

เนื้อหาทั้งหมดในไฟล์นี้แปลงมาจากบทสนทนาการออกแบบระบบใน Qwen Chat ให้เป็นโครงสร้างโปรเจกต์จริง

## 🗂️ โครงสร้างโปรเจกต์

```
technician-schedule-system/
├── backend/                        # Node.js + Express + MongoDB
│   ├── config/
│   │   ├── database.js
│   │   └── logger.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   ├── WorkOrder.js
│   │   └── Notification.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── workOrderRoutes.js
│   │   └── notificationRoutes.js
│   ├── cron/
│   │   └── overdueCheck.js
│   ├── test/
│   │   └── cancelWorkOrder.test.js
│   ├── .env
│   ├── package.json
│   ├── server.js
│   └── seed.js
└── frontend/                        # Angular
    └── src/
        ├── environments/
        │   └── environment.ts
        └── app/
            ├── services/
            │   ├── auth.service.ts
            │   └── work-order.service.ts
            ├── components/
            │   ├── calendar/calendar.component.ts
            │   ├── work-order-form/work-order-form.component.ts
            │   ├── work-order-detail/work-order-detail.component.ts
            │   └── cancelled-orders/cancelled-orders.component.ts
            ├── app.module.ts
            ├── app-routing.module.ts     ← ไฟล์เสริม (จำเป็นสำหรับ routing)
            └── app.component.ts          ← ไฟล์เสริม (root component)
```

> **หมายเหตุ:** `app-routing.module.ts` และ `app.component.ts` ไม่ได้อยู่ในโครงสร้างที่ระบุไว้ตอนแรก
> แต่ `app.module.ts` import ทั้งสองไฟล์นี้โดยตรง ระบบจึงคอมไพล์ไม่ผ่านถ้าไม่มี จึงเพิ่มให้ครบเพื่อให้รันได้จริง
> เช่นเดียวกับ `environments/environment.ts` ที่ service ทั้งสองไฟล์ import ใช้ `environment.apiUrl`

## 📋 ข้อกำหนดระบบ

| Component | Version |
|-----------|---------|
| Node.js | 18.x หรือใหม่กว่า |
| MongoDB | 6.0 หรือใหม่กว่า |
| Angular CLI | 16.x |
| npm | 9.x |

## 🔧 ติดตั้ง Backend

```bash
cd backend
npm install
```

สร้าง/ตรวจสอบไฟล์ `.env` (มีให้แล้วในโฟลเดอร์ backend):

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/tech_schedule
MONGODB_URI_TEST=mongodb://localhost:27017/tech_schedule_test
JWT_SECRET=your-super-secret-key-change-in-production-2026
JWT_EXPIRE=7d
LOG_LEVEL=info
```

เริ่ม MongoDB (เลือกตามระบบปฏิบัติการ):
- Windows: เริ่มบริการ MongoDB จาก Services
- Linux: `sudo systemctl start mongod`
- Mac: `brew services start mongodb-community`

ใส่ข้อมูลเริ่มต้น (ผู้ใช้ทดสอบ + ตัวอย่างงาน):

```bash
npm run seed
```

รันเซิร์ฟเวอร์:

```bash
npm run dev
```

Backend จะรันที่ `http://localhost:3000`

## 🎨 ติดตั้ง Frontend

โฟลเดอร์ `frontend/` ในไฟล์นี้มีเฉพาะไฟล์ที่เขียนขึ้นเอง (services, components, module) ยังไม่ใช่โปรเจกต์
Angular ที่สมบูรณ์ ต้องสร้างโครงโปรเจกต์ด้วย Angular CLI ก่อนแล้วจึงคัดลอกไฟล์เหล่านี้ทับเข้าไป:

```bash
# 1. สร้างโปรเจกต์ Angular ใหม่ในโฟลเดอร์ frontend (ตอบ No สำหรับคำถามที่ถามเพิ่ม ถ้ามี)
ng new frontend --routing --style=scss
cd frontend

# 2. ติดตั้ง dependency เพิ่มเติมที่โค้ดใช้งาน
npm install @angular/material @angular/cdk moment ngx-toastr

# 3. คัดลอกไฟล์จากโฟลเดอร์ frontend/src ของไฟล์นี้ ทับไฟล์ที่ ng new สร้างไว้
#    (environments/environment.ts, app/app.module.ts, app/app-routing.module.ts,
#     app/app.component.ts, app/services/*, app/components/*)

# 4. รัน development server
ng serve
```

เปิดเบราว์เซอร์ที่ `http://localhost:4200`

## 👤 บัญชีทดสอบ (จาก seed.js)

| Username | Password | Role |
|----------|----------|------|
| admin | password123 | Admin |
| supervisor | password123 | Supervisor |
| somchai | password123 | Technician |
| somchai_dit | password123 | Technician |
| bunsong | password123 | Technician |
| kong | password123 | Technician |
| suda | password123 | Technician |
| prayai | password123 | Technician |

## 📖 คู่มือการใช้งาน

### สำหรับช่าง (Technician)

**สร้างแผนงาน (Planning)**
1. กดปุ่ม "เพิ่มงานใหม่"
2. กรอก: ชื่อลูกค้า/โรงพยาบาล, สถานที่, ประเภทงาน (MA/ติดตั้ง/ซ่อม/DR), วันที่วางแผน, เวลาเริ่ม-สิ้นสุด, รายละเอียดงาน
3. กด "บันทึก" → ระบบสร้าง SR Number อัตโนมัติ (เช่น SR-202609-0001) สถานะเป็น "รออนุมัติ"

**ดูตารางงาน**: หน้า Calendar แสดงงานทั้งเดือน — สีฟ้า = Planning, สีเขียว = Actual (เสร็จแล้ว), สีแดง = Overdue (ค้าง)

**บันทึกงานจริง (Actual)**: เปิดงานที่ "อนุมัติแล้ว" → กด "บันทึกงานจริง" → กรอกวันที่/เวลา/สถานที่จริง/รายละเอียด → บันทึก → สถานะเป็น "เสร็จสิ้น"

**เลื่อนงาน**: เปิดรายละเอียดงาน → กด "เลื่อนงาน" → เลือกวันที่ใหม่ + เหตุผล → ระบบบันทึกประวัติและแจ้งเตือนหัวหน้า → งานกลับไป "รออนุมัติ"

**ยกเลิกงาน**: เปิดรายละเอียดงาน → กด "🚫 ยกเลิกงาน" → ระบุเหตุผล (อย่างน้อย 10 ตัวอักษร) หรือเลือกเหตุผลด่วน (ลูกค้าขอยกเลิก/อุปกรณ์ไม่พร้อม/ติดงานเร่งด่วน/สภาพอากาศ/อื่นๆ) → ยืนยัน → ระบบแจ้งเตือนหัวหน้างานอัตโนมัติ
(งานที่ "เสร็จสิ้น" หรือ "ยกเลิกแล้ว" จะยกเลิกซ้ำไม่ได้)

### สำหรับหัวหน้างาน (Supervisor)

- **ดูงานทั้งหมด**: กดปุ่ม "งานทั้งหมด" ที่หน้า Calendar
- **อนุมัติแผนงาน**: เปิดงานที่ "รออนุมัติ" → กด "อนุมัติแผนงาน"
- **ดูงานค้าง**: ระบบแสดง Alert สีแดงด้านบนเมื่อมีงานค้าง พร้อมจำนวนวันที่ค้าง
- **ยกเลิกงานของช่างคนใดก็ได้**: เช่นเดียวกับช่าง แต่ทำได้กับทุกงาน
- **ดูรายงานงานที่ยกเลิก**: เข้าเมนู "รายงานงานที่ยกเลิก" → เลือกเดือน/ปี → ดูรายการทั้งหมดพร้อมเหตุผลและผู้ยกเลิก

### Workflow สรุป

```
ช่างสร้างงาน → รออนุมัติ → หัวหน้าอนุมัติ → ช่างทำงานจริง → เสร็จสิ้น
                    │                              │
                    ├─ เลื่อนงาน → รออนุมัติใหม่      ├─ ไม่ทำภายในวัน → ค้างเกินกำหนด (Overdue)
                    │                              │
                    └─ ยกเลิกงาน (โดยช่างหรือหัวหน้า) ─┘
```

สถานะงานทั้งหมด: `draft → pending_approval → approved → in_progress → completed / overdue / cancelled / rescheduled`

## 🧪 Testing

```bash
cd backend
npm test
```

`test/cancelWorkOrder.test.js` ครอบคลุม: ยกเลิกงานในฐานะเจ้าของ, ห้ามยกเลิกถ้าไม่ระบุเหตุผล, ห้ามยกเลิกถ้าเหตุผลสั้นเกินไป, หัวหน้ายกเลิกงานของช่างคนอื่นได้, ห้ามยกเลิกงานที่เสร็จแล้ว

## ✅ สรุปฟีเจอร์

| ฟีเจอร์ | สถานะ |
|---------|--------|
| ตารางงานรายบุคคล (Planning/Actual) | ✅ |
| หน้ารวมแผนก (ดูงานทุกคน) | ✅ |
| หัวหน้าอนุมัติ Planning | ✅ |
| ช่างกรอก Actual | ✅ |
| SR Number อัตโนมัติ | ✅ |
| หลายงาน/วัน | ✅ |
| แจ้งเตือนงานค้าง (Auto, cron ทุกวัน 08:00) | ✅ |
| ประวัติการเลื่อนงาน | ✅ |
| ยกเลิกงาน + เหตุผล + Quick reasons | ✅ |
| รายงานงานที่ยกเลิก | ✅ |
| Responsive (Mobile + Desktop) | ✅ |
| Logging ทุกการกระทำ (winston) | ✅ |
| Testing (jest + supertest) | ✅ |

## ⚠️ สิ่งที่ควรทำต่อ (ไม่ได้รวมโค้ดไว้ในไฟล์นี้)

โค้ดต้นฉบับใน Qwen chat ยังเสนอแนวทางเพิ่มเติมที่ยังไม่ได้ implement เป็นโค้ดจริง หากต้องการให้สร้างเพิ่มสามารถแจ้งได้:
- Offline mode / PWA (สำหรับพื้นที่เน็ตไม่เสถียร)
- Export รายงานเป็น PDF/Excel
- แจ้งเตือนผ่าน Line Notify หรือ Email
- Dashboard KPI (จำนวนงาน/คน/เดือน, งานค้าง, งานเลื่อน)
