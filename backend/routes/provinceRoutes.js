const express = require('express');
const { protect } = require('../middleware/auth');
const REGION_BY_PROVINCE = require('../data/provinceRegions');

const router = express.Router();

router.get('/regions', protect, (req, res) => {
  res.json(REGION_BY_PROVINCE);
});

module.exports = router;
