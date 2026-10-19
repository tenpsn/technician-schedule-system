// ข้อมูลจังหวัด อำเภอ ตำบล และรหัสไปรษณีย์ ดึงมาจากแพ็กเกจ thai-data เวอร์ชัน 3.0.2
// โครงสร้างคือ จังหวัด แล้วอำเภอ แล้วตำบล คู่กับรหัสไปรษณีย์
const ADDRESS_TREE = require('../data/thaiAddress.json');

const BANGKOK = 'กรุงเทพมหานคร';

const isBangkok = (province) => province === BANGKOK;

// เช็คว่าตำบลอยู่ในอำเภอและจังหวัดนั้นจริง
function isValidLocation(province, district, subdistrict) {
  return Boolean(ADDRESS_TREE[province]?.[district]?.[subdistrict] !== undefined);
}

function postalCodeOf(province, district, subdistrict) {
  return ADDRESS_TREE[province]?.[district]?.[subdistrict] || null;
}

// รวมเป็นที่อยู่เต็ม กรุงเทพใช้แขวงกับเขต จังหวัดอื่นใช้ตำบลกับอำเภอ
function composeAddress({ addressLine, province, district, subdistrict, postalCode }) {
  const parts = [addressLine?.trim()];
  if (isBangkok(province)) {
    parts.push(subdistrict && `แขวง${subdistrict}`, district && `เขต${district}`, province);
  } else {
    parts.push(subdistrict && `ตำบล${subdistrict}`, district && `อำเภอ${district}`, province && `จังหวัด${province}`);
  }
  parts.push(postalCode);
  return parts.filter(Boolean).join(' ');
}

// หาชื่อที่ตามหลังคำนำหน้าก่อน เช่น ตำบล หรือ แขวง ถ้าไม่มีค่อยหาชื่อที่ปรากฏเฉย ๆ
// เลือกชื่อที่ยาวที่สุด กันชื่อสั้นที่ซ้อนอยู่ในชื่ออื่น
function findLongestName(text, names, prefixes) {
  const longest = (list) => list.sort((a, b) => b.length - a.length)[0] || null;
  const prefixed = names.filter((name) => prefixes.some((prefix) => text.includes(prefix + name) || text.includes(`${prefix} ${name}`)));
  return longest(prefixed) || longest(names.filter((name) => text.includes(name)));
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ลบเฉพาะจุดสุดท้ายที่ตรงรูปแบบ ถ้าไม่เจอก็คืนข้อความเดิม
function removeLast(text, globalPattern) {
  const matches = [...text.matchAll(globalPattern)];
  const last = matches[matches.length - 1];
  return last ? text.slice(0, last.index) + ' ' + text.slice(last.index + last[0].length) : text;
}

// อ่านอำเภอและตำบลจากที่อยู่เดิม ต้องรู้จังหวัดก่อน
// ตัดส่วนที่อ่านได้ออก เหลือบ้านเลขที่ หมู่ ถนน ไว้เป็น addressLine
function parseLegacyAddress(address, province) {
  const districts = ADDRESS_TREE[province];
  if (!address || !districts) return null;

  const district = findLongestName(address, Object.keys(districts), ['อำเภอ', 'อ.', 'เขต']);
  // ตำบลค้นเฉพาะในอำเภอที่เจอ ถ้าไม่เจออำเภอก็ไม่เดาตำบล เพราะชื่อตำบลซ้ำกันข้ามอำเภอได้
  const subdistrict = district ? findLongestName(address, Object.keys(districts[district]), ['ตำบล', 'ต.', 'แขวง']) : null;

  // ตัดจากท้ายข้อความก่อน เพราะชื่ออำเภออาจซ้ำกับชื่อถนนที่อยู่ข้างหน้า
  let addressLine = address.replace(/\d{5}\s*$/, '');
  addressLine = removeLast(addressLine, new RegExp(`(จังหวัด|จ\\.)?\\s*${escapeRegExp(province)}`, 'g'));
  if (district) addressLine = removeLast(addressLine, new RegExp(`(อำเภอ|อ\\.|เขต)\\s*${escapeRegExp(district)}`, 'g'));
  if (subdistrict) addressLine = removeLast(addressLine, new RegExp(`(ตำบล|ต\\.|แขวง)\\s*${escapeRegExp(subdistrict)}`, 'g'));
  addressLine = addressLine.replace(/\s+/g, ' ').trim();

  return {
    district,
    subdistrict,
    postalCode: subdistrict ? postalCodeOf(province, district, subdistrict) : null,
    addressLine
  };
}

module.exports = { ADDRESS_TREE, BANGKOK, isBangkok, isValidLocation, postalCodeOf, composeAddress, parseLegacyAddress };
