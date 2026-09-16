const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Contract = require('./Contract');
const WorkOrder = require('./WorkOrder');

// One row per scheduled MA (maintenance) visit within a contract's MA interval,
// auto-generated from the contract's start/end date + interval, and individually
// movable afterwards (e.g. the 2nd visit gets rescheduled to a different day).
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
  // Set once a supervisor assigns this visit to a technician — the actual
  // job then lives (and is tracked/approved/rescheduled) as a normal WorkOrder.
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
