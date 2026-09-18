const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Contract = require('./Contract');
const WorkOrder = require('./WorkOrder');

// หนึ่งแถวคือหนึ่งครั้งของการเข้า MA ตามช่วงเวลาของสัญญา สร้างอัตโนมัติจากวันเริ่มวันสิ้นสุดและช่วงเวลา
// และย้ายวันทีหลังได้ทีละครั้ง เช่น เลื่อนครั้งที่ 2 ไปวันอื่น
const MaVisit = sequelize.define('MaVisit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  contractId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: Contract, key: 'id' }
  },
  sequenceNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  scheduledDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  // จะถูกตั้งค่าตอนหัวหน้างานมอบหมายช่างให้ visit นี้ หลังจากนั้นงานจริงจะกลายเป็น WorkOrder ปกติ
  // ที่ติดตาม อนุมัติ และเลื่อนนัดได้เหมือนใบงานทั่วไป
  workOrderId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: WorkOrder, key: 'id' }
  }
}, {
  tableName: 'ma_visits',
  timestamps: false,
  indexes: [
    { fields: ['contractId'] }
  ]
});

MaVisit.belongsTo(Contract, { as: 'contract', foreignKey: 'contractId' });
Contract.hasMany(MaVisit, { as: 'visits', foreignKey: 'contractId' });
MaVisit.belongsTo(WorkOrder, { as: 'workOrder', foreignKey: 'workOrderId' });

MaVisit.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  delete values.id;
  if (values.workOrder) {
    values.workOrder = values.workOrder.toJSON ? values.workOrder.toJSON() : values.workOrder;
  }
  return values;
};

module.exports = MaVisit;
