// ฟิลด์วันที่อย่าง plannedDate เก็บและสร้างเป็น UTC midnight ของวันที่ต้องการเสมอ ดู overdueCalc.js และ lineJobParser.js
// ต้อง format ด้วย timeZone UTC เพื่อให้วันที่แสดงตรงกับค่าที่เก็บไว้ ไม่ขึ้นกับเวลาท้องถิ่นของเครื่อง
const formatThaiDate = (date) => new Date(date).toLocaleDateString('th-TH', { timeZone: 'UTC' });

module.exports = { formatThaiDate };
