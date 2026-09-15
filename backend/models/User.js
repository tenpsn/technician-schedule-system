const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: { len: [3, 50] }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { len: [6, 255] }
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('technician', 'supervisor', 'admin'),
    defaultValue: 'technician'
  },
  email: {
    type: DataTypes.STRING,
    validate: { isEmail: true }
  },
  phone: DataTypes.STRING,
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lineUserId: {
    type: DataTypes.STRING,
    unique: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  updatedAt: false,
  hooks: {
    beforeValidate: (user) => {
      if (user.username) user.username = user.username.trim();
      if (user.fullName) user.fullName = user.fullName.trim();
      if (user.email) user.email = user.email.trim().toLowerCase();
      if (user.phone) user.phone = user.phone.trim();
    }
  }
});

// Hide password when serializing
User.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  delete values.id;
  delete values.password;
  return values;
};

module.exports = User;
