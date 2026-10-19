const express = require('express');
const { protect } = require('../middleware/auth');
const REGION_BY_PROVINCE = require('../data/provinceRegions');
const { ADDRESS_TREE } = require('../utils/thaiAddress');

const router = express.Router();

router.get('/regions', protect, (req, res) => {
  res.json(REGION_BY_PROVINCE);
});

// รายการจังหวัด อำเภอ ตำบล และรหัสไปรษณีย์ทั้งประเทศ ข้อมูลไม่เปลี่ยน ให้ browser เก็บไว้ได้หนึ่งวัน
router.get('/address-tree', protect, (req, res) => {
  res.set('Cache-Control', 'private, max-age=86400');
  res.json(ADDRESS_TREE);
});

module.exports = router;
