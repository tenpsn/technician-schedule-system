const WORK_TYPES = ['MA', 'ติดตั้ง', 'ซ่อม', 'อื่นๆ'];
const REPAIR_TYPE = 'ซ่อม';
const INSTALLATION_TYPE = 'ติดตั้ง';
const OTHER_TYPE = 'อื่นๆ';

function isRepairType(workType) {
  return workType === REPAIR_TYPE;
}

function isInstallationType(workType) {
  return workType === INSTALLATION_TYPE;
}

module.exports = { WORK_TYPES, REPAIR_TYPE, INSTALLATION_TYPE, OTHER_TYPE, isRepairType, isInstallationType };
