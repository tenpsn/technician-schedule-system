// นับจำนวนครั้งที่ล็อกอินผิดต่อคีย์ เช่น lineUserId หรือ username เพื่อชะลอคนที่เดารหัสผ่าน ทั้งจาก LINE และฟอร์มเว็บ
// เก็บในหน่วยความจำเท่านั้น เหมือน lineSession.js ข้อมูลจะหายเมื่อรีสตาร์ท
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// คืนจำนวนนาทีที่เหลือถ้าถูกล็อก ถ้าไม่ถูกล็อกคืนค่า null
const checkLocked = (lineUserId) => {
  const entry = attempts.get(lineUserId);
  if (!entry || !entry.lockedUntil) return null;
  if (Date.now() >= entry.lockedUntil) {
    attempts.delete(lineUserId);
    return null;
  }
  return Math.ceil((entry.lockedUntil - Date.now()) / 60000);
};

// คืนจำนวนครั้งที่เหลือก่อนถูกล็อก ถ้าเป็น 0 แปลว่าการผิดครั้งนี้ทำให้ถูกล็อกพอดี
// ให้ผู้เรียกใช้เตือนผู้ใช้ได้ เช่น เหลืออีก 2 ครั้ง
const recordFailure = (lineUserId) => {
  const entry = attempts.get(lineUserId) || { count: 0, lockedUntil: null };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  attempts.set(lineUserId, entry);
  return Math.max(0, MAX_ATTEMPTS - entry.count);
};

const recordSuccess = (lineUserId) => {
  attempts.delete(lineUserId);
};

module.exports = { checkLocked, recordFailure, recordSuccess, MAX_ATTEMPTS };
