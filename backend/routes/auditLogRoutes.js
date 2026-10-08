const express = require('express');
const { Op } = require('sequelize');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');
const { sendServerError } = require('../utils/httpErrors');
const logger = require('../config/logger');

const router = express.Router();

const escapeLikePattern = (str) => str.replace(/[\\%_]/g, (c) => `\\${c}`);
const MAX_PAGE_SIZE = 100;

// ดึงประวัติการแก้ไขสัญญาและรายชื่อโรงพยาบาล ใหม่สุดก่อน แบ่งหน้าที่ server เพราะประวัติจะยาวขึ้นเรื่อยๆ
router.get('/', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { entityType, search } = req.query;
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 20, 1), MAX_PAGE_SIZE);
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    const conditions = [];
    if (entityType === 'hospital' || entityType === 'contract') conditions.push({ entityType });
    if (search && search.trim()) {
      const pattern = `%${escapeLikePattern(search.trim())}%`;
      conditions.push({ [Op.or]: [{ entityLabel: { [Op.iLike]: pattern } }, { actorName: { [Op.iLike]: pattern } }] });
    }
    const where = { [Op.and]: conditions };

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    res.json({ items: rows, total: count, page, pageSize });
  } catch (error) {
    logger.error(`Get audit logs error: ${error.message}`);
    sendServerError(res);
  }
});

module.exports = router;
