const REGION_BY_PROVINCE = require('../data/provinceRegions');

const PROVINCE_NAMES = Object.keys(REGION_BY_PROVINCE);

// หาชื่อจังหวัดจากข้อความที่อยู่ เลือกชื่อที่อยู่ท้ายสุด เพราะที่อยู่ไทยเขียนจังหวัดไว้ท้าย
// ถ้าจบตำแหน่งเดียวกันให้เลือกชื่อที่ยาวกว่า กันชื่อสั้นที่ซ้อนอยู่ในชื่ออื่น
function guessProvinceFromAddress(address) {
  if (!address) return null;
  let bestName = null;
  let bestEnd = -1;
  for (const name of PROVINCE_NAMES) {
    const index = address.lastIndexOf(name);
    if (index < 0) continue;
    const end = index + name.length;
    if (end > bestEnd || (end === bestEnd && name.length > bestName.length)) {
      bestName = name;
      bestEnd = end;
    }
  }
  return bestName;
}

module.exports = { guessProvinceFromAddress };
