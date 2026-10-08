const express = require('express');
const { Op } = require('sequelize');
const Hospital = require('../models/Hospital');
const Contract = require('../models/Contract');
const { protect, authorize } = require('../middleware/auth');
const { sendServerError } = require('../utils/httpErrors');
const logger = require('../config/logger');
const { diffFields, recordAudit } = require('../utils/auditLog');

// ช่องที่เก็บในประวัติการแก้ไข
const auditSnapshot = (h) => ({ name: h.name, address: h.address, facilityCode: h.facilityCode || null });

const router = express.Router();

// ILIKE ตีความ % กับ _ เป็น wildcard ถึงแม้ Sequelize จะกัน SQL injection แล้วก็ตาม
// ต้อง escape ก่อน ไม่งั้นคำค้นที่มีตัวอักษรพวกนี้จะแมตช์ผิดความหมาย
const escapeLikePattern = (str) => str.replace(/[\\%_]/g, (c) => `\\${c}`);

// ดึงหรือค้นหารายชื่อโรงพยาบาล มีคำค้นคือ autocomplete ไม่มีคำค้นคือดึงทั้งหมดสำหรับหน้าจัดการ
router.get('/', protect, async (req, res) => {
  try {
    const { search, limit } = req.query;
    const where = search ? { name: { [Op.iLike]: `%${escapeLikePattern(search)}%` } } : {};

    const hospitals = await Hospital.findAll({
      where,
      order: [['name', 'ASC']],
      limit: limit ? parseInt(limit) : 20
    });

    res.json(hospitals);
  } catch (error) {
    logger.error(`Get hospitals error: ${error.message}`);
    sendServerError(res);
  }
});

// เพิ่มโรงพยาบาลใหม่ สำหรับหัวหน้างานหรือ admin เท่านั้น
router.post('/', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { name, address, facilityCode } = req.body;

    if (!name || !address) {
      return res.status(400).json({ code: 'hospital_fields_required', message: 'Please provide hospital name and address' });
    }

    const hospital = await Hospital.create({
      name: name.trim(),
      address: address.trim(),
      facilityCode: facilityCode ? facilityCode.trim() : null
    });
    logger.info(`Hospital added: ${hospital.name} (${hospital.address})`);
    await recordAudit({
      entityType: 'hospital', entityId: hospital.id, entityLabel: hospital.name, action: 'create',
      changes: diffFields(null, auditSnapshot(hospital)), user: req.user
    });
    res.status(201).json(hospital);
  } catch (error) {
    logger.error(`Create hospital error: ${error.message}`);
    sendServerError(res);
  }
});

// แก้ไขโรงพยาบาล สำหรับหัวหน้างานหรือ admin เท่านั้น
router.patch('/:id', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { name, address, facilityCode } = req.body;

    if (!name || !address) {
      return res.status(400).json({ code: 'hospital_fields_required', message: 'Please provide hospital name and address' });
    }

    const hospital = await Hospital.findByPk(req.params.id);
    if (!hospital) {
      return res.status(404).json({ code: 'hospital_not_found', message: 'Hospital not found' });
    }

    const before = auditSnapshot(hospital);
    hospital.name = name.trim();
    hospital.address = address.trim();
    hospital.facilityCode = facilityCode ? facilityCode.trim() : null;
    await hospital.save();
    logger.info(`Hospital updated: ${hospital.name} (${hospital.address})`);
    const changes = diffFields(before, auditSnapshot(hospital));
    // กดบันทึกโดยไม่ได้เปลี่ยนอะไรไม่ต้องเก็บประวัติ
    if (changes.length > 0) {
      await recordAudit({ entityType: 'hospital', entityId: hospital.id, entityLabel: hospital.name, action: 'update', changes, user: req.user });
    }
    res.json(hospital);
  } catch (error) {
    logger.error(`Update hospital error: ${error.message}`);
    sendServerError(res);
  }
});

// ลบโรงพยาบาล สำหรับหัวหน้างานหรือ admin เท่านั้น
router.delete('/:id', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const hospital = await Hospital.findByPk(req.params.id);

    if (!hospital) {
      return res.status(404).json({ code: 'hospital_not_found', message: 'Hospital not found' });
    }

    const contractCount = await Contract.count({ where: { hospitalId: hospital.id } });
    if (contractCount > 0) {
      return res.status(400).json({ code: 'hospital_has_contracts', message: 'Cannot delete: contracts are linked to this hospital' });
    }

    await hospital.destroy();
    logger.info(`Hospital removed: ${hospital.name}`);
    await recordAudit({
      entityType: 'hospital', entityId: hospital.id, entityLabel: hospital.name, action: 'delete',
      changes: diffFields(auditSnapshot(hospital), null), user: req.user
    });
    res.json({ success: true });
  } catch (error) {
    logger.error(`Delete hospital error: ${error.message}`);
    sendServerError(res);
  }
});

module.exports = router;
