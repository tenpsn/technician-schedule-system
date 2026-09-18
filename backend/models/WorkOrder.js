const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');
const { computeOverdue } = require('../utils/overdueCalc');

const WorkOrder = sequelize.define('WorkOrder', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  srNumber: {
    // รูปแบบเลขที่ SR ตามด้วยปีเดือนและเลขลำดับ
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  technicianId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: User, key: 'id' }
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customerLocation: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // ค่าเป็น MA ติดตั้ง ซ่อม หรือข้อความอิสระเมื่อผู้ใช้เลือกอื่นๆ ในฟอร์ม
  workType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(1000)
  },

  // ส่วนวางแผน
  plannedDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  plannedStartTime: {
    type: DataTypes.STRING,
    validate: { is: /^$|^([01]\d|2[0-3]):([0-5]\d)$/ }
  },
  plannedEndTime: {
    type: DataTypes.STRING,
    validate: { is: /^$|^([01]\d|2[0-3]):([0-5]\d)$/ }
  },

  // ส่วนผลจริง
  actualDate: DataTypes.DATE,
  actualStartTime: DataTypes.STRING,
  actualEndTime: DataTypes.STRING,
  actualLocation: DataTypes.STRING,
  actualDescription: DataTypes.TEXT,

  // ใช้เฉพาะตอน workType เป็นซ่อม เก็บว่าเสร็จหรือไม่ และเหตุผลถ้ายังไม่เสร็จ
  repairCompleted: DataTypes.BOOLEAN,
  repairIncompleteReason: DataTypes.TEXT,

  // ใช้เฉพาะตอน workType เป็นติดตั้ง เก็บว่าส่งมอบเครื่องให้ลูกค้าแล้วหรือยัง
  installationDelivered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  // ทุกครั้งที่บันทึกผลจริงจะถูกเพิ่มต่อท้ายที่นี่ เพราะงานซ่อมหรือติดตั้งอาจต้องเข้างานหลายครั้งกว่าจะเสร็จ
  // ฟิลด์ actualDate actualStartTime และอื่นๆ ด้านบนจะสะท้อนค่ารายการล่าสุดเสมอ
  actualLog: {
    type: DataTypes.JSONB,
    defaultValue: []
  },

  // สถานะขั้นตอนงาน
  status: {
    type: DataTypes.ENUM('draft', 'pending_approval', 'approved', 'in_progress',
      'completed', 'overdue', 'cancelled', 'rescheduled'),
    defaultValue: 'draft'
  },

  // ส่วนอนุมัติ approvedById approvedAt approvalNote จะสะท้อนรายการล่าสุดใน approvalHistory เสมอ
  // เพราะงานสามารถถูกอนุมัติซ้ำได้ทุกครั้งหลังเลื่อนนัด
  approvedById: {
    type: DataTypes.UUID,
    references: { model: User, key: 'id' }
  },
  approvedAt: DataTypes.DATE,
  approvalNote: DataTypes.TEXT,
  approvalHistory: {
    type: DataTypes.JSONB,
    defaultValue: []
  },

  // ติดตามการเลื่อนนัด
  rescheduleHistory: {
    type: DataTypes.JSONB,
    defaultValue: []
  },

  // การยกเลิก
  cancelledById: {
    type: DataTypes.UUID,
    references: { model: User, key: 'id' }
  },
  cancelledAt: DataTypes.DATE,
  cancelReason: DataTypes.TEXT,

  // เอกสาร
  serviceReportUrl: DataTypes.STRING,
  photos: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },

  // สถานะเลยกำหนด
  isOverdue: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  overdueDays: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'work_orders',
  timestamps: true,
  indexes: [
    { fields: ['technicianId', 'plannedDate'] },
    { fields: ['status'] },
    { fields: ['srNumber'] },
    { fields: ['cancelledAt'] }
  ]
});

WorkOrder.belongsTo(User, { as: 'technician', foreignKey: 'technicianId' });
WorkOrder.belongsTo(User, { as: 'approvedBy', foreignKey: 'approvedById' });
WorkOrder.belongsTo(User, { as: 'cancelledBy', foreignKey: 'cancelledById' });

// เลียนแบบพฤติกรรม populate ของ Mongoose ฟิลด์เก็บได้ทั้ง id ดิบหรือ object User ที่โหลดมาแล้ว ภายใต้ key เดียวกัน
WorkOrder.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  delete values.id;

  const mapRef = (key, idKey) => {
    if (values[key] === undefined) {
      values[key] = values[idKey] || null;
    }
    delete values[idKey];
  };
  mapRef('technician', 'technicianId');
  mapRef('approvedBy', 'approvedById');
  mapRef('cancelledBy', 'cancelledById');

  // isOverdue กับ overdueDays ที่เก็บไว้เป็นแค่ snapshot จาก cron ครั้งล่าสุด ดู overdueCalc.js
  // คำนวณสดตรงนี้ใหม่ทุกครั้ง เพื่อให้ response ตรงกับเวลาที่ผ่านไปจริง ไม่ใช่ค่าที่ค้างมาตั้งแต่แรกเลยกำหนด
  const { isOverdue, overdueDays } = computeOverdue(values);
  values.isOverdue = isOverdue;
  values.overdueDays = overdueDays;

  return values;
};

module.exports = WorkOrder;
