const ADD_JOB_KEYWORD = /^เพิ่มงาน/;

const FIELD_LABELS = {
  customerName: 'ลูกค้า',
  customerLocation: 'สถานที่',
  workType: 'ประเภทงาน',
  plannedDateRaw: 'วันที่',
  plannedTimeRaw: 'เวลา',
  description: 'รายละเอียด'
};

// เป็นจริงเฉพาะรูปแบบเก่าพิมพ์รวดเดียว คือบรรทัดคำสั่งตามด้วยฟิลด์ที่มีป้ายกำกับ
// ถ้าพิมพ์แค่เพิ่มงานเฉยๆ จะเข้ารูปแบบทีละขั้นแทน
const isAddJobMessage = (text) => {
  const trimmed = text.trim();
  return ADD_JOB_KEYWORD.test(trimmed) && trimmed.split('\n').length > 1;
};

// รับรูปแบบวันเดือนปี เป็นปีคริสต์ศักราช
const parseThaiDate = (str) => {
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  const year = Number(y);
  // สร้างจากค่า UTC โดยตรง ไม่ใช้ new Date ปกติที่อิงเวลาท้องถิ่นของเครื่อง
  // เพื่อให้ตรงกับ convention UTC midnight ที่ plannedDate ใช้ทั่วระบบ ดู overdueCalc.js
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date จะปัดวันเดือนที่ไม่มีจริงไปเป็นเดือนถัดไปแทนที่จะ error เช่น 31 เมษายนจะกลายเป็น 1 พฤษภาคม
  // จึงต้องเช็คว่าค่าที่ได้ตรงกับวันที่พิมพ์จริงหรือไม่ ถ้าไม่ตรงถือว่าไม่ถูกต้อง
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
};

const parseTimeRange = (str) => {
  const m = str.trim().match(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  return { start: `${m[1]}:${m[2]}`, end: `${m[3]}:${m[4]}` };
};

// ตัวอย่างข้อความที่ฟังก์ชันนี้แปลงได้ เช่น เพิ่มงาน ตามด้วยลูกค้า สถานที่ ประเภทงาน วันที่ เวลา รายละเอียด
const parseAddJobMessage = (text) => {
  const lines = text.split('\n').slice(1);
  const fields = {};

  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const label = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!value) continue;

    const key = Object.keys(FIELD_LABELS).find((k) => FIELD_LABELS[k] === label);
    if (key) fields[key] = value;
  }

  // customerLocation ไม่บังคับตรงนี้ ถ้าไม่กรอกผู้เรียกจะไปค้นจากชื่อลูกค้าในรายชื่อโรงพยาบาลแทน
  const missing = [];
  if (!fields.customerName) missing.push(FIELD_LABELS.customerName);
  if (!fields.workType) missing.push(FIELD_LABELS.workType);
  if (!fields.plannedDateRaw) missing.push(FIELD_LABELS.plannedDateRaw);
  if (missing.length > 0) return { ok: false, missing };

  const plannedDate = parseThaiDate(fields.plannedDateRaw);
  if (!plannedDate) return { ok: false, invalidDate: true };

  let plannedStartTime;
  let plannedEndTime;
  if (fields.plannedTimeRaw) {
    const range = parseTimeRange(fields.plannedTimeRaw);
    if (!range) return { ok: false, invalidTime: true };
    plannedStartTime = range.start;
    plannedEndTime = range.end;
  }

  return {
    ok: true,
    data: {
      customerName: fields.customerName,
      customerLocation: fields.customerLocation,
      // เก็บค่าตามที่พิมพ์เลย เหมือนช่องอื่นๆ แบบพิมพ์อิสระในฟอร์มเว็บ ไม่เทียบกับ MA ติดตั้ง ซ่อม
      // ถ้าพิมพ์ผิดก็จะถูกเก็บตามที่พิมพ์ผิดนั้นเลย
      workType: fields.workType,
      description: fields.description,
      plannedDate,
      plannedStartTime,
      plannedEndTime
    }
  };
};

module.exports = { isAddJobMessage, parseAddJobMessage, parseThaiDate, parseTimeRange };
