// กำหนดของใบงานคือเวลาสิ้นสุดตามวันที่วางแผนไว้ ถ้าไม่ระบุเวลาสิ้นสุดถือว่าครบกำหนดตอนสิ้นวันนั้น สร้างจากค่า UTC ล้วนๆ ไม่ใช้ new Date กับ setHours
// เพราะ plannedDate parse เป็น UTC midnight ตาม JS spec แต่ setHours ตั้งเวลาท้องถิ่น ผสมกันจะเพี้ยนถ้าเครื่องไม่ได้ตั้ง TZ เป็น Asia Bangkok
const getDeadline = (order) => {
  const dateOnly = new Date(order.plannedDate);
  const y = dateOnly.getUTCFullYear();
  const m = dateOnly.getUTCMonth();
  const d = dateOnly.getUTCDate();
  if (order.plannedEndTime) {
    const [hours, minutes] = order.plannedEndTime.split(':').map(Number);
    return new Date(Date.UTC(y, m, d, hours, minutes, 0, 0));
  }
  return new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
};

// สถานะที่กำหนดเวลามีความหมาย ตรงกับเงื่อนไขที่ cron ใบงานเลยกำหนดใช้ค้นหา บวกสถานะ overdue เองด้วย
const TRACKABLE_STATUSES = ['pending_approval', 'approved', 'in_progress', 'overdue'];

// คำนวณสดจาก plannedDate กับ plannedEndTime แทนเชื่อคอลัมน์ isOverdue กับ overdueDays ที่เขียนแค่ครั้งเดียวตอน cron เปลี่ยนสถานะเป็น overdue
// หลังจากนั้นงานจะหลุดจากรายการที่ cron ตรวจ ค่าที่เก็บไว้เลยค้างอยู่แบบเดิมตลอด ไม่ถูกคำนวณซ้ำอีก
const computeOverdue = (order, now = new Date()) => {
  if (!TRACKABLE_STATUSES.includes(order.status)) {
    return { isOverdue: false, overdueDays: 0 };
  }
  const deadline = getDeadline(order);
  if (deadline >= now) {
    return { isOverdue: false, overdueDays: 0 };
  }
  const overdueDays = Math.floor((now - deadline) / (1000 * 60 * 60 * 24));
  return { isOverdue: true, overdueDays };
};

module.exports = { getDeadline, computeOverdue };
