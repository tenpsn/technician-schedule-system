const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// ประวัติการเพิ่ม แก้ไข ลบ ข้อมูลสัญญาและรายชื่อโรงพยาบาล ดู utils/auditLog.js
// เก็บชื่อรายการกับชื่อผู้ทำไว้ในแถวเลย ไม่อ้างอิงด้วย foreign key เพราะรายการที่ถูกลบหรือผู้ใช้ที่เปลี่ยนชื่อต้องยังอ่านประวัติได้
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  entityType: {
    type: DataTypes.ENUM('hospital', 'contract'),
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
    type: DataTypes.ENUM('create', 'update', 'delete'),
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

AuditLog.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  delete values.id;
  return values;
};

module.exports = AuditLog;
