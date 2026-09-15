// In-memory per-technician conversation state for multi-step LINE flows
// (e.g. answering "เพิ่มงาน" one field at a time). Lost on server restart
// and not shared across instances — acceptable for a single-process bot.
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
