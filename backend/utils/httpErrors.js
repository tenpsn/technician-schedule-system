// Sends a generic 500 response instead of leaking the raw exception text
// (DB connection errors, Sequelize messages, stack traces, ...) straight to
// the client — every frontend error handler shows `err.error.message`
// directly to the user, so an unhandled exception used to surface verbatim
// as a popup. The real detail still goes to the server log via the caller's
// own `logger.error(...)` call right before this.
const sendServerError = (res) => {
  res.status(500).json({ code: 'server_error', message: 'Something went wrong' });
};

module.exports = { sendServerError };
