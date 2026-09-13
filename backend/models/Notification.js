const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');
const WorkOrder = require('./WorkOrder');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  recipientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: User, key: 'id' }
  },
  type: {
    type: DataTypes.ENUM('overdue', 'approval_needed', 'rescheduled', 'completed', 'cancelled'),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  relatedWorkOrderId: {
    type: DataTypes.UUID,
    references: { model: WorkOrder, key: 'id' }
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['recipientId', 'createdAt'] },
    { fields: ['isRead'] }
  ]
});

Notification.belongsTo(User, { as: 'recipient', foreignKey: 'recipientId' });
Notification.belongsTo(WorkOrder, { as: 'relatedWorkOrder', foreignKey: 'relatedWorkOrderId' });

Notification.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  delete values.id;

  const mapRef = (key, idKey) => {
    if (values[key] === undefined) {
      values[key] = values[idKey] || null;
    }
    delete values[idKey];
  };
  mapRef('recipient', 'recipientId');
  mapRef('relatedWorkOrder', 'relatedWorkOrderId');

  return values;
};

module.exports = Notification;
