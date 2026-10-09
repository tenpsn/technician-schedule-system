const express = require('express');
const { Op } = require('sequelize');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { sendServerError } = require('../utils/httpErrors');
const logger = require('../config/logger');

const router = express.Router();

const escapeLikePattern = (str) => str.replace(/[\\%_]/g, (c) => `\\${c}`);
const MAX_PAGE_SIZE = 100;

// ดึงประวัติการแก้ไขสัญญา รายชื่อโรงพยาบาล และบัญชีผู้ใช้ ใหม่สุดก่อน แบ่งหน้าที่ server เพราะประวัติจะยาวขึ้นเรื่อยๆ
// ให้ admin ดูได้คนเดียว เพราะหน้าประวัติอยู่ใต้หน้าตั้งค่าผู้ใช้งาน
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { entityType, search } = req.query;
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 20, 1), MAX_PAGE_SIZE);
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    const conditions = [];
    if (['hospital', 'contract', 'user'].includes(entityType)) conditions.push({ entityType });
    if (search && search.trim()) {
      const pattern = `%${escapeLikePattern(search.trim())}%`;
      conditions.push({ [Op.or]: [{ entityLabel: { [Op.iLike]: pattern } }, { actorName: { [Op.iLike]: pattern } }] });
    }
    const where = { [Op.and]: conditions };

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include: [
        { model: User, as: 'actor', attributes: ['id', 'avatarUrl'] },
        { model: User, as: 'subjectUser', attributes: ['id', 'avatarUrl'] }
      ]
    });

    res.json({ items: rows, total: count, page, pageSize });
  } catch (error) {
    logger.error(`Get audit logs error: ${error.message}`);
    sendServerError(res);
  }
});

module.exports = router;
