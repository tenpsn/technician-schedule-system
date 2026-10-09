const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

// ประวัติการเพิ่ม แก้ไข ลบ ข้อมูลสัญญา รายชื่อโรงพยาบาล และบัญชีผู้ใช้ ดู utils/auditLog.js
// เก็บชื่อรายการกับชื่อผู้ทำไว้ในแถวเลย ไม่อ้างอิงด้วย foreign key เพราะรายการที่ถูกลบหรือผู้ใช้ที่เปลี่ยนชื่อต้องยังอ่านประวัติได้
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  entityType: {
    type: DataTypes.ENUM('hospital', 'contract', 'user'),
    allowNull: false
  },
  entityId: {
    type: DataTypes.UUID
  },
  entityLabel: {
    type: DataTypes.STRING,
    allowNull: false
  },
  action: {
    // activate กับ deactivate ใช้กับบัญชีผู้ใช้เท่านั้น
    type: DataTypes.ENUM('create', 'update', 'delete', 'activate', 'deactivate'),
    allowNull: false
  },
  // รายการช่องที่เปลี่ยน แต่ละช่องเป็น field from to และ seq สำหรับรอบเข้า MA
  changes: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  actorId: {
    type: DataTypes.UUID
  },
  actorName: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['createdAt'] },
    { fields: ['entityType', 'createdAt'] }
  ]
});

// ใช้ดึงรูปโปรไฟล์มาแสดงเท่านั้น ปิด constraints ไว้ตามเหตุผลด้านบนที่ไม่ใช้ foreign key
// subjectUser มีค่าเฉพาะประวัติของบัญชีผู้ใช้ เพราะ entityId ของโรงพยาบาลหรือสัญญาไม่ตรงกับผู้ใช้คนไหน
AuditLog.belongsTo(User, { as: 'actor', foreignKey: 'actorId', constraints: false });
AuditLog.belongsTo(User, { as: 'subjectUser', foreignKey: 'entityId', constraints: false });

AuditLog.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  delete values.id;
  return values;
};

module.exports = AuditLog;
