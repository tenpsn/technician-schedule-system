const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const REGION_BY_PROVINCE = require('../data/provinceRegions');
const { guessProvinceFromAddress } = require('../utils/provinceFromAddress');
const { parseLegacyAddress } = require('../utils/thaiAddress');

const Hospital = sequelize.define('Hospital', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // ที่อยู่เต็มที่รวมจากช่องด้านล่าง ส่วนอื่นของระบบ เช่น ใบงาน MA และ LINE ยังใช้ช่องนี้
  address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // บ้านเลขที่ หมู่ ถนน ส่วนตำบล อำเภอ จังหวัด เลือกจากรายการ
  // ค่าว่างคือยังไม่เคยแยกที่อยู่ ใช้บอกว่าต้องอ่านจากที่อยู่เดิมให้
  addressLine: DataTypes.STRING,
  subdistrict: DataTypes.STRING,
  district: DataTypes.STRING,
  postalCode: DataTypes.STRING,
  facilityCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // ใช้แยกภาคของสัญญา หัวหน้าภาคใต้เห็นแค่สัญญาของโรงพยาบาลภาคใต้
  province: DataTypes.STRING,
  region: DataTypes.STRING
}, {
  tableName: 'hospitals',
  timestamps: false,
  hooks: {
    // คำนวณภาคจากจังหวัดทุกครั้งที่บันทึก แบบเดียวกับผู้ใช้
    beforeSave: (hospital) => {
      hospital.region = hospital.province ? (REGION_BY_PROVINCE[hospital.province] || null) : null;
    }
  },
  indexes: [
    { fields: ['name'] }
  ]
});

Hospital.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  delete values.id;
  return values;
};

// โรงพยาบาลที่มีก่อนแยกช่องที่อยู่ อ่านจังหวัด อำเภอ ตำบล จากที่อยู่เดิมให้ครั้งเดียว
// ไม่แตะที่อยู่เต็มเดิม ส่วนที่อ่านไม่ออกปล่อยว่างไว้ให้คนเลือกเองในหน้าตั้งค่า
Hospital.backfillAddresses = async () => {
  const hospitals = await Hospital.findAll({ where: { addressLine: null } });
  let filled = 0;
  for (const hospital of hospitals) {
    hospital.province = hospital.province || guessProvinceFromAddress(hospital.address);
    const parts = hospital.province ? parseLegacyAddress(hospital.address, hospital.province) : null;
    hospital.district = parts?.district || null;
    hospital.subdistrict = parts?.subdistrict || null;
    hospital.postalCode = parts?.postalCode || null;
    hospital.addressLine = parts ? parts.addressLine : hospital.address;
    await hospital.save();
    if (hospital.subdistrict) filled++;
  }
  return { checked: hospitals.length, filled };
};

module.exports = Hospital;
