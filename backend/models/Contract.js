const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Hospital = require('./Hospital');

const Contract = sequelize.define('Contract', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  hospitalId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: Hospital, key: 'id' }
  },
  contractNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  // ช่วงเวลาการเข้า MA ตามสัญญาบำรุงรักษา หน่วยเป็นเดือน เช่น ทุก 1 3 4 6 หรือ 12 เดือน
  maIntervalMonths: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 12 }
  }
}, {
  tableName: 'contracts',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['hospitalId'] }
  ]
});

Contract.belongsTo(Hospital, { as: 'hospital', foreignKey: 'hospitalId' });
Hospital.hasMany(Contract, { as: 'contracts', foreignKey: 'hospitalId' });

Contract.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  delete values.id;
  if (values.hospital) {
    values.hospital = values.hospital.toJSON ? values.hospital.toJSON() : values.hospital;
  }
  return values;
};

module.exports = Contract;
