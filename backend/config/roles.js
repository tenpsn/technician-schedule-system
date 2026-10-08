const SUPERVISOR_ROLES = ['supervisor', 'admin'];

function isSupervisorRole(role) {
  return SUPERVISOR_ROLES.includes(role);
}

// หัวหน้าช่างภาคใต้เท่านั้นที่ถูกจำกัดสิทธิ์นี้ (ไม่รวม admin) ภาคอื่นยังจัดการงานของช่างได้ทุกคนเหมือนเดิม
const RESTRICTED_SUPERVISOR_REGION = 'ใต้';

// หัวหน้าช่างภาคใต้เห็นและจัดการได้แค่ช่างกับงานภาคใต้ ภาคอื่นมองไม่เห็นเลย
function isRegionRestricted(user) {
  return user.role === 'supervisor' && user.region === RESTRICTED_SUPERVISOR_REGION;
}

// ใช้เช็คงานรายตัว ทั้งดู อนุมัติ เลื่อน ยกเลิก บันทึกผล รูป และแจ้งเตือน
// order ต้องโหลด technician พร้อม region มาด้วย
function isBlockedByRegion(user, order) {
  return order.technicianId !== user.id && isRegionRestricted(user)
    && order.technician?.region !== RESTRICTED_SUPERVISOR_REGION;
}

module.exports = { SUPERVISOR_ROLES, isSupervisorRole, RESTRICTED_SUPERVISOR_REGION, isRegionRestricted, isBlockedByRegion };
