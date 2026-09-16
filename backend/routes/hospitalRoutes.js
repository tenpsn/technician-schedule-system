const express = require('express');
const { Op } = require('sequelize');
const Hospital = require('../models/Hospital');
const Contract = require('../models/Contract');
const { protect, authorize } = require('../middleware/auth');
const { sendServerError } = require('../utils/httpErrors');
const logger = require('../config/logger');

const router = express.Router();

// ILIKE treats %, _ and \ as pattern metacharacters even though Sequelize
// parameterizes the value — escape them so a search term containing one of
// these matches literally instead of being reinterpreted as a wildcard.
const escapeLikePattern = (str) => str.replace(/[\\%_]/g, (c) => `\\${c}`);

// List / search hospitals (search = autocomplete, no search = full list for management)
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

// Add a new hospital (Supervisor/Admin only)
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
    res.status(201).json(hospital);
  } catch (error) {
    logger.error(`Create hospital error: ${error.message}`);
    sendServerError(res);
  }
});

// Edit a hospital (Supervisor/Admin only)
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

    hospital.name = name.trim();
    hospital.address = address.trim();
    hospital.facilityCode = facilityCode ? facilityCode.trim() : null;
    await hospital.save();
    logger.info(`Hospital updated: ${hospital.name} (${hospital.address})`);
    res.json(hospital);
  } catch (error) {
    logger.error(`Update hospital error: ${error.message}`);
    sendServerError(res);
  }
});

// Delete a hospital (Supervisor/Admin only)
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
    res.json({ success: true });
  } catch (error) {
    logger.error(`Delete hospital error: ${error.message}`);
    sendServerError(res);
  }
});

module.exports = router;
