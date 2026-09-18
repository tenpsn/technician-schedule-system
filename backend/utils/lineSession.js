// เก็บสถานะการสนทนาของช่างแต่ละคนไว้ในหน่วยความจำ สำหรับขั้นตอน LINE ที่ถามทีละฟิลด์ เช่น เพิ่มงาน
// ข้อมูลหายเมื่อรีสตาร์ทและไม่แชร์ข้าม instance ยอมรับได้เพราะบอทรันโปรเซสเดียว
const sessions = new Map();
const TTL_MS = 10 * 60 * 1000;

const get = (lineUserId) => {
  const session = sessions.get(lineUserId);
  if (!session) return null;
  if (Date.now() - session.updatedAt > TTL_MS) {
    sessions.delete(lineUserId);
    return null;
  }
  return session;
};

const set = (lineUserId, session) => {
  sessions.set(lineUserId, { ...session, updatedAt: Date.now() });
};

const clear = (lineUserId) => sessions.delete(lineUserId);

module.exports = { get, set, clear };
