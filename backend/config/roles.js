const SUPERVISOR_ROLES = ['supervisor', 'admin'];

function isSupervisorRole(role) {
  return SUPERVISOR_ROLES.includes(role);
}

module.exports = { SUPERVISOR_ROLES, isSupervisorRole };
