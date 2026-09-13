const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const WorkOrder = sequelize.define('WorkOrder', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  srNumber: {
    // Format: SR-YYYYMM-XXXX
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
  // 'MA' | 'ติดตั้ง' | 'ซ่อม' | free text when the user picks "อื่นๆ" on the form
  workType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(1000)
  },

  // Planning
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

  // Actual
  actualDate: DataTypes.DATE,
  actualStartTime: DataTypes.STRING,
  actualEndTime: DataTypes.STRING,
  actualLocation: DataTypes.STRING,
  actualDescription: DataTypes.TEXT,

  // Status workflow
  status: {
    type: DataTypes.ENUM('draft', 'pending_approval', 'approved', 'in_progress',
      'completed', 'overdue', 'cancelled', 'rescheduled'),
    defaultValue: 'draft'
  },

  // Approval
  approvedById: {
    type: DataTypes.UUID,
    references: { model: User, key: 'id' }
  },
  approvedAt: DataTypes.DATE,
  approvalNote: DataTypes.TEXT,

  // Reschedule tracking
  rescheduleHistory: {
    type: DataTypes.JSONB,
    defaultValue: []
  },

  // Cancellation
  cancelledById: {
    type: DataTypes.UUID,
    references: { model: User, key: 'id' }
  },
  cancelledAt: DataTypes.DATE,
  cancelReason: DataTypes.TEXT,

  // Documents
  serviceReportUrl: DataTypes.STRING,
  customerSignature: DataTypes.STRING,
  photos: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },

  // Overdue flag
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

// Mirror Mongoose's populate behavior: field holds either the raw id
// or the populated User object, under the same key either way.
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

  return values;
};

module.exports = WorkOrder;
