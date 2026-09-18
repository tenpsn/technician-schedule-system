// สร้างขอบเขตเดือนปีแบบ UTC เพื่อกรองคอลัมน์ DATE ที่เก็บวันแบบ UTC midnight ดู overdueCalc.js
// ถ้าใช้ new Date ปกติจะอิงเวลาท้องถิ่นของเครื่อง ตรงกันโดยบังเอิญแค่ตอนไม่ได้ตั้ง TZ เท่านั้น
const monthRangeUTC = (year, month) => {
  const y = parseInt(year, 10);
  if (month) {
    const m = parseInt(month, 10) - 1;
    return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + 1, 1)) };
  }
  return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)) };
};

module.exports = { monthRangeUTC };
