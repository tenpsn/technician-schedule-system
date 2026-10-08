const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

// เทียบค่าเดิมกับค่าใหม่ทีละช่อง เก็บเฉพาะช่องที่เปลี่ยนจริง ตอนเพิ่มค่าเดิมเป็น null ตอนลบค่าใหม่เป็น null
const diffFields = (before, after) => {
  const keys = Object.keys(after || before);
  return keys
    .map((field) => ({ field, from: before ? before[field] ?? null : null, to: after ? after[field] ?? null : null }))
    .filter((c) => c.from !== c.to);
};

// บันทึกไม่สำเร็จไม่ควรทำให้การแก้ข้อมูลจริงที่สำเร็จไปแล้วพังตาม แค่จด error ไว้
const recordAudit = async ({ entityType, entityId, entityLabel, action, changes, user }) => {
  try {
    await AuditLog.create({
      entityType, entityId, entityLabel, action, changes,
      actorId: user?.id || null, actorName: user?.fullName || null
    });
  } catch (error) {
    logger.error(`Audit log error (${entityType} ${action} ${entityLabel}): ${error.message}`);
  }
};

module.exports = { diffFields, recordAudit };
