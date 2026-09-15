const ADD_JOB_KEYWORD = /^เพิ่มงาน/;

const FIELD_LABELS = {
  customerName: 'ลูกค้า',
  customerLocation: 'สถานที่',
  workType: 'ประเภทงาน',
  plannedDateRaw: 'วันที่',
  plannedTimeRaw: 'เวลา',
  description: 'รายละเอียด'
};

// Only true for the old one-shot format (keyword line + labeled field lines).
// A bare "เพิ่มงาน" with nothing else starts the step-by-step flow instead.
const isAddJobMessage = (text) => {
  const trimmed = text.trim();
  return ADD_JOB_KEYWORD.test(trimmed) && trimmed.split('\n').length > 1;
};

// Accepts DD/MM/YYYY (Gregorian year)
const parseThaiDate = (str) => {
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const parseTimeRange = (str) => {
  const m = str.trim().match(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  return { start: `${m[1]}:${m[2]}`, end: `${m[3]}:${m[4]}` };
};

// Parses a message like:
//   เพิ่มงาน
//   ลูกค้า: รพ.กรุงเทพ
//   สถานที่: ห้อง ICU ชั้น 3
//   ประเภทงาน: ซ่อม
//   วันที่: 20/09/2026
//   เวลา: 09:00-12:00
//   รายละเอียด: เครื่องมอนิเตอร์ไม่ขึ้นสัญญาณ
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

  // customerLocation is intentionally not required here — when omitted, the
  // caller looks it up from the hospital master list by customerName instead.
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
      // Stored as-is, same as the web form's "อื่นๆ" free-text field — no
      // matching against MA/ติดตั้ง/ซ่อม, so a typo is saved verbatim.
      workType: fields.workType,
      description: fields.description,
      plannedDate,
      plannedStartTime,
      plannedEndTime
    }
  };
};

module.exports = { isAddJobMessage, parseAddJobMessage, parseThaiDate, parseTimeRange };
