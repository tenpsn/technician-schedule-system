const express = require('express');
const { Op } = require('sequelize');
const Hospital = require('../models/Hospital');
const Contract = require('../models/Contract');
const { protect, authorize } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// List / search hospitals (search = autocomplete, no search = full list for management)
router.get('/', protect, async (req, res) => {
  try {
    const { search, limit } = req.query;
    const where = search ? { name: { [Op.iLike]: `%${search}%` } } : {};

    const hospitals = await Hospital.findAll({
      where,
      order: [['name', 'ASC']],
      limit: limit ? parseInt(limit) : 20
    });

    res.json(hospitals);
  } catch (error) {
    logger.error(`Get hospitals error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Add a new hospital (Supervisor/Admin only)
router.post('/', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { name, address, facilityCode } = req.body;

    if (!name || !address) {
      return res.status(400).json({ message: 'กรุณากรอกชื่อโรงพยาบาลและที่อยู่' });
    }

    const hospital = await Hospital.create({
      name: name.trim(),
      address: address.trim(),
      facilityCode: facilityCode ? facilityCode.trim() : null
    });
    logger.info(`Hospital added: ${hospital.name} (${hospital.address})`);
    res.status(201).json(hospital);
  } catch (error) {
    logger.error(`Create hospital error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Edit a hospital (Supervisor/Admin only)
router.patch('/:id', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { name, address, facilityCode } = req.body;

    if (!name || !address) {
      return res.status(400).json({ message: 'กรุณากรอกชื่อโรงพยาบาลและที่อยู่' });
    }

    const hospital = await Hospital.findByPk(req.params.id);
    if (!hospital) {
      return res.status(404).json({ message: 'ไม่พบโรงพยาบาลนี้' });
    }

    hospital.name = name.trim();
    hospital.address = address.trim();
    hospital.facilityCode = facilityCode ? facilityCode.trim() : null;
    await hospital.save();
    logger.info(`Hospital updated: ${hospital.name} (${hospital.address})`);
    res.json(hospital);
  } catch (error) {
    logger.error(`Update hospital error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Delete a hospital (Supervisor/Admin only)
router.delete('/:id', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const hospital = await Hospital.findByPk(req.params.id);

    if (!hospital) {
      return res.status(404).json({ message: 'ไม่พบโรงพยาบาลนี้' });
    }

    const contractCount = await Contract.count({ where: { hospitalId: hospital.id } });
    if (contractCount > 0) {
      return res.status(400).json({ message: 'ไม่สามารถลบได้ เนื่องจากมีสัญญาผูกกับโรงพยาบาลนี้อยู่' });
    }

    await hospital.destroy();
    logger.info(`Hospital removed: ${hospital.name}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Delete hospital error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
