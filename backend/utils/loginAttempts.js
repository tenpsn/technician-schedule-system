// Tracks failed login attempts per key (LINE lineUserId, or web username), to
// slow down someone guessing a password — whether over LINE chat or the
// regular /api/auth/login form. In-memory only — same single-process
// assumption as utils/lineSession.js (resets on restart).
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// Returns minutes remaining if locked out, otherwise null.
const checkLocked = (lineUserId) => {
  const entry = attempts.get(lineUserId);
  if (!entry || !entry.lockedUntil) return null;
  if (Date.now() >= entry.lockedUntil) {
    attempts.delete(lineUserId);
    return null;
  }
  return Math.ceil((entry.lockedUntil - Date.now()) / 60000);
};

// Returns how many attempts are left before lockout (0 means this failure
// just triggered the lockout), so callers can warn "2 tries left" etc.
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
