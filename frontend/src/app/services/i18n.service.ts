import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Lang = 'th' | 'en';

const STORAGE_KEY = 'ui.lang';

const DICT: Record<Lang, Record<string, string>> = {
  th: {
    brand: 'ระบบจัดการงานช่าง', langShort: 'TH', themeBtn: 'สลับโหมดสว่าง/มืด',
    login: 'เข้าสู่ระบบ', logout: 'ออกจากระบบ', username: 'ชื่อผู้ใช้', password: 'รหัสผ่าน',
    loginLead: 'ตารางงานบริการเครื่องมือแพทย์ รายเดือน รายสัปดาห์ และรายวัน สำหรับทีมช่างและผู้จัดตารางงาน',
    access: 'สิทธิ์การเข้าถึง', accessAll: 'ผู้ดูแลระบบและหัวหน้าช่างเห็นงานของช่างทุกคน',
    accessOwn: 'ช่างเทคนิคเห็นเฉพาะงานที่ได้รับมอบหมายของตัวเอง',
    searchPh: 'ค้นหา SR / ลูกค้า / ประเภทงาน',
    navSchedule: 'ตารางงาน', navMySchedule: 'ตารางงานของฉัน', navAdd: 'เพิ่มงาน',
    navCancelled: 'งานที่ยกเลิก', navHospitals: 'ตั้งค่า โรงพยาบาล',
    team: 'ทีมช่าง', clearFilter: 'ล้างตัวกรอง', queueTitle: 'รออนุมัติแผนงาน',
    viewMonth: 'ปฏิทินเดือน', viewWeek: 'สัปดาห์', viewDay: 'ไทม์ไลน์รายวัน',
    jobsUnit: 'งาน', hoursUnit: 'ชม.', techLoad: 'ชั่วโมงงานเดือนนี้', statQueued: 'รออนุมัติ',
    scopeAll: 'งานของทุกคน', scopeMine: 'งานของฉัน', scopeOwnOnly: 'สิทธิ์: เห็นเฉพาะงานของตัวเอง',
    jobDetail: 'รายละเอียดงาน', back: 'กลับ', planning: 'Planning (แผนงาน)', planDate: 'วันที่วางแผน',
    timeLabel: 'เวลา', statusLabel: 'สถานะงาน', customer: 'ลูกค้า', site: 'สถานที่', jobType: 'ประเภทงาน',
    owner: 'ช่างผู้รับผิดชอบ', postpone: 'เลื่อนงาน', cancelJob: 'ยกเลิกงาน', approvePlan: 'อนุมัติแผนงาน',
    updateStatus: 'บันทึกงานจริง', createdBy: 'ผู้สร้างงาน', addJob: 'เพิ่มงานใหม่',
    customerInfo: 'ข้อมูลลูกค้า', jobInfo: 'รายละเอียดงาน',
    hospitalName: 'ชื่อลูกค้า/โรงพยาบาล', selectHospital: '-- เลือกโรงพยาบาล --', selectType: '-- เลือกประเภทงาน --',
    sitePh: 'เช่น สูงเนิน โคราช', jobDesc: 'รายละเอียด / อาการที่แจ้ง', jobDescPh: 'ระบุอาการ อุปกรณ์ และสิ่งที่ต้องเตรียม',
    startTime: 'เวลาเริ่ม', endTime: 'เวลาสิ้นสุด', saveJob: 'บันทึกงาน', cancel: 'ยกเลิก',
    cancelReport: 'รายงานงานที่ยกเลิก', month: 'เดือน', year: 'ปี', foundItems: 'พบ', items: 'รายการ',
    colSr: 'SR Number', colHospital: 'ลูกค้า', colType: 'ประเภท', colTech: 'ช่าง', colPlan: 'วันที่วางแผน',
    colBy: 'ผู้ยกเลิก', colAt: 'เวลายกเลิก', colReason: 'เหตุผล',
    hospitalSettings: 'ตั้งค่ารายชื่อโรงพยาบาล', province: 'จังหวัด', hospitalNamePh: 'เช่น สูงเนิน',
    provincePh: 'เช่น นครราชสีมา', addHospital: 'เพิ่มโรงพยาบาล', searchList: 'ค้นหาในรายการ...', delete: 'ลบ',
    allOf: 'ทั้งหมด', cancelWarn: 'การยกเลิกงานจะไม่สามารถกู้คืนได้ กรุณาระบุเหตุผลให้ชัดเจน',
    cancelReason: 'เหตุผลการยกเลิก', cancelReasonPh: 'เช่น ลูกค้าขอยกเลิก, อุปกรณ์ไม่พร้อม, ติดงานอื่นที่เร่งด่วนกว่า...',
    commonReasons: 'เหตุผลทั่วไป (คลิกเพื่อเลือก):', confirmCancel: 'ยืนยันการยกเลิก',
    newDate: 'วันที่ใหม่', postponeReason: 'เหตุผลที่เลื่อน', postponeReasonPh: 'อธิบายเหตุผลที่ต้องเลื่อน...',
    confirmPostpone: 'ยืนยันการเลื่อน',
    logoutTitle: 'ออกจากระบบ', logoutBody: 'ต้องการออกจากระบบตอนนี้หรือไม่ งานที่กรอกค้างไว้และยังไม่บันทึกจะหายไป',
    logoutConfirm: 'ยืนยันออกจากระบบ', stayIn: 'อยู่ในระบบต่อ',
    roleAdmin: 'ผู้ดูแลระบบ', roleSupervisor: 'หัวหน้าช่าง', roleTechnician: 'ช่างเทคนิค',
    overdueAlert: 'งานค้างเกินกำหนด', overdueDaysSuffix: 'วัน', viewDetail: 'ดูรายละเอียด',
    actualDate: 'วันที่ทำงานจริง', actualLocation: 'สถานที่จริง', actualDescription: 'รายละเอียดงานที่ทำได้จริง',
    save: 'บันทึก', rescheduleHistory: 'ประวัติการเลื่อน', reasonWord: 'เหตุผล', byWord: 'โดย',
    cancelledInfo: 'งานนี้ถูกยกเลิกแล้ว', cancelledBy: 'ผู้ยกเลิก', cancelledAt: 'เวลายกเลิก',
    today: 'วันนี้', prev: 'ก่อนหน้า', next: 'ถัดไป', noResults: 'ไม่พบข้อมูล', loading: 'กำลังโหลด...',
    saving: 'กำลังบันทึก…', saved: 'บันทึกแล้ว ✓', approving: 'กำลังอนุมัติ…', approvedDone: 'อนุมัติแล้ว ✓',
    cancelling: 'กำลังยกเลิก…', cancelledDone: 'ยกเลิกแล้ว ✓', postponing: 'กำลังเลื่อน…', postponedDone: 'เลื่อนแล้ว ✓',
    approveTitle: 'อนุมัติแผนงาน', approveBody: 'เมื่ออนุมัติแล้ว งานจะถูกยืนยันเข้าตารางของช่างและแจ้งเตือนผู้เกี่ยวข้อง',
    reviewEdit: 'แก้ไขก่อน', yesConfirm: 'ตกลง ยืนยัน', confirmStep: 'ตรวจสอบก่อนยืนยัน',
    irreversible: 'การดำเนินการนี้ไม่สามารถย้อนกลับได้', confirmCancelQ: 'ยืนยันการยกเลิกงาน',
    toastLogin: 'เข้าสู่ระบบสำเร็จ', toastSaved: 'บันทึกงานใหม่สำเร็จ', toastApproved: 'อนุมัติแผนงานสำเร็จ',
    toastCancelled: 'ยกเลิกงานแล้ว', toastPostponed: 'เลื่อนงานสำเร็จ รออนุมัติ', toastStatus: 'อัปเดตสถานะงานแล้ว',
    toastHospital: 'เพิ่มโรงพยาบาลแล้ว', toastDeleted: 'ลบรายการแล้ว', toastFilterCleared: 'ล้างตัวกรองแล้ว',
    toastNeedReason: 'กรุณาระบุเหตุผลก่อนยืนยัน',
    navUsers: 'ตั้งค่าผู้ใช้งาน', userSettings: 'ตั้งค่าผู้ใช้งาน', addUser: 'เพิ่มผู้ใช้งาน',
    role: 'บทบาท', status: 'สถานะ', active: 'ใช้งานอยู่', inactive: 'ปิดใช้งานแล้ว',
    activate: 'เปิดใช้งาน', deactivate: 'ปิดใช้งาน', usernamePh: 'เช่น somchai',
    fullNamePh: 'เช่น สมชาย ใจดี', passwordPh: 'อย่างน้อย 6 ตัวอักษร', optional: '(ไม่บังคับ)',
    colUsername: 'ชื่อผู้ใช้', colFullName: 'ชื่อ-สกุล', colRole: 'บทบาท', colStatus: 'สถานะ',
    toastUserAdded: 'เพิ่มผู้ใช้งานแล้ว', toastUserUpdated: 'บันทึกการเปลี่ยนแปลงแล้ว',
    cannotDeactivateSelf: 'ไม่สามารถปิดใช้งานบัญชีตัวเองได้', confirmDeactivate: 'ยืนยันปิดใช้งานบัญชีนี้?',
    confirmActivate: 'ยืนยันเปิดใช้งานบัญชีนี้อีกครั้ง?',
    myProfile: 'ข้อมูลของฉัน', email: 'อีเมล', phone: 'เบอร์โทรศัพท์',
    changePassword: 'เปลี่ยนรหัสผ่าน', currentPassword: 'รหัสผ่านปัจจุบัน', newPassword: 'รหัสผ่านใหม่',
    newPasswordPh: 'เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน', toastProfileUpdated: 'บันทึกข้อมูลส่วนตัวแล้ว',
    notifications: 'การแจ้งเตือน', markAllRead: 'อ่านทั้งหมด', noNotifications: 'ไม่มีการแจ้งเตือน',
  },
  en: {
    brand: 'Technician Schedule System', langShort: 'EN', themeBtn: 'Toggle light / dark',
    login: 'Sign in', logout: 'Sign out', username: 'Username', password: 'Password',
    loginLead: 'Monthly, weekly and daily service schedules for medical equipment teams and dispatchers.',
    access: 'Access levels', accessAll: 'Administrator and lead technician see every technician’s jobs',
    accessOwn: 'Technician sees only their own assigned jobs',
    searchPh: 'Search SR / customer / job type',
    navSchedule: 'Schedule', navMySchedule: 'My schedule', navAdd: 'New job',
    navCancelled: 'Cancelled jobs', navHospitals: 'Hospital settings',
    team: 'Technicians', clearFilter: 'Clear filters', queueTitle: 'Pending approval',
    viewMonth: 'Month', viewWeek: 'Week', viewDay: 'Day timeline',
    jobsUnit: 'jobs', hoursUnit: 'h', techLoad: 'Hours scheduled this month', statQueued: 'Pending',
    scopeAll: 'All technicians', scopeMine: 'My jobs only', scopeOwnOnly: 'Access: own jobs only',
    jobDetail: 'Job detail', back: 'Back', planning: 'Planning', planDate: 'Planned date',
    timeLabel: 'Time', statusLabel: 'Status', customer: 'Customer', site: 'Site', jobType: 'Job type',
    owner: 'Assigned technician', postpone: 'Postpone', cancelJob: 'Cancel job', approvePlan: 'Approve plan',
    updateStatus: 'Log completed work', createdBy: 'Created by', addJob: 'New job',
    customerInfo: 'Customer', jobInfo: 'Job details',
    hospitalName: 'Customer / hospital name', selectHospital: '-- select hospital --', selectType: '-- select job type --',
    sitePh: 'e.g. Sung Noen, Korat', jobDesc: 'Description / reported issue', jobDescPh: 'Symptoms, equipment and parts to prepare',
    startTime: 'Start', endTime: 'End', saveJob: 'Save job', cancel: 'Cancel',
    cancelReport: 'Cancelled jobs report', month: 'Month', year: 'Year', foundItems: 'Found', items: 'records',
    colSr: 'SR Number', colHospital: 'Customer', colType: 'Type', colTech: 'Technician', colPlan: 'Planned date',
    colBy: 'Cancelled by', colAt: 'Cancelled at', colReason: 'Reason',
    hospitalSettings: 'Hospital list settings', province: 'Province', hospitalNamePh: 'e.g. Sung Noen',
    provincePh: 'e.g. Nakhon Ratchasima', addHospital: 'Add hospital', searchList: 'Search list...', delete: 'Delete',
    allOf: 'Showing', cancelWarn: 'Cancelling a job cannot be undone. Please state a clear reason.',
    cancelReason: 'Cancellation reason', cancelReasonPh: 'e.g. customer cancelled, parts not ready, higher-priority job...',
    commonReasons: 'Common reasons (click to use):', confirmCancel: 'Confirm cancellation',
    newDate: 'New date', postponeReason: 'Reason for postponing', postponeReasonPh: 'Explain why this job must move...',
    confirmPostpone: 'Confirm postpone',
    logoutTitle: 'Sign out', logoutBody: 'Sign out now? Anything typed but not saved will be lost.',
    logoutConfirm: 'Yes, sign out', stayIn: 'Stay signed in',
    roleAdmin: 'Administrator', roleSupervisor: 'Lead technician', roleTechnician: 'Technician',
    overdueAlert: 'Overdue jobs', overdueDaysSuffix: 'days', viewDetail: 'View detail',
    actualDate: 'Actual date', actualLocation: 'Actual location', actualDescription: 'Description of work performed',
    save: 'Save', rescheduleHistory: 'Reschedule history', reasonWord: 'Reason', byWord: 'By',
    cancelledInfo: 'This job has been cancelled', cancelledBy: 'Cancelled by', cancelledAt: 'Cancelled at',
    today: 'Today', prev: 'Prev', next: 'Next', noResults: 'No results', loading: 'Loading...',
    saving: 'Saving…', saved: 'Saved ✓', approving: 'Approving…', approvedDone: 'Approved ✓',
    cancelling: 'Cancelling…', cancelledDone: 'Cancelled ✓', postponing: 'Rescheduling…', postponedDone: 'Rescheduled ✓',
    approveTitle: 'Approve plan', approveBody: 'Once approved the job is locked into the technician’s schedule and everyone involved is notified.',
    reviewEdit: 'Edit first', yesConfirm: 'Yes, confirm', confirmStep: 'Review before confirming',
    irreversible: 'This action cannot be undone', confirmCancelQ: 'Confirm cancellation of',
    toastLogin: 'Signed in', toastSaved: 'New job saved', toastApproved: 'Plan approved',
    toastCancelled: 'Job cancelled', toastPostponed: 'Job rescheduled, pending approval', toastStatus: 'Job status updated',
    toastHospital: 'Hospital added', toastDeleted: 'Record deleted', toastFilterCleared: 'Filters cleared',
    toastNeedReason: 'Please state a reason first',
    navUsers: 'User settings', userSettings: 'User settings', addUser: 'Add user',
    role: 'Role', status: 'Status', active: 'Active', inactive: 'Deactivated',
    activate: 'Activate', deactivate: 'Deactivate', usernamePh: 'e.g. somchai',
    fullNamePh: 'e.g. Somchai Jaidee', passwordPh: 'At least 6 characters', optional: '(optional)',
    colUsername: 'Username', colFullName: 'Full name', colRole: 'Role', colStatus: 'Status',
    toastUserAdded: 'User added', toastUserUpdated: 'Changes saved',
    cannotDeactivateSelf: 'You cannot deactivate your own account', confirmDeactivate: 'Deactivate this account?',
    confirmActivate: 'Reactivate this account?',
    myProfile: 'My profile', email: 'Email', phone: 'Phone number',
    changePassword: 'Change password', currentPassword: 'Current password', newPassword: 'New password',
    newPasswordPh: 'Leave blank to keep your current password', toastProfileUpdated: 'Profile updated',
    notifications: 'Notifications', markAllRead: 'Mark all read', noNotifications: 'No notifications',
  }
};

const STATUS_LABEL: Record<Lang, Record<string, string>> = {
  th: {
    draft: 'ร่าง', pending_approval: 'รออนุมัติ', approved: 'อนุมัติแล้ว', in_progress: 'กำลังดำเนินการ',
    completed: 'เสร็จสิ้น', overdue: 'ค้างเกินกำหนด', cancelled: 'ยกเลิกแล้ว', rescheduled: 'เลื่อนแล้ว'
  },
  en: {
    draft: 'Draft', pending_approval: 'Pending approval', approved: 'Approved', in_progress: 'In progress',
    completed: 'Completed', overdue: 'Overdue', cancelled: 'Cancelled', rescheduled: 'Rescheduled'
  }
};

const TYPE_LABEL_EN: Record<string, string> = {
  'MA': 'MA (Preventive)', 'ติดตั้ง': 'Installation', 'ซ่อม': 'Repair'
};

const ROLE_KEY: Record<string, string> = {
  admin: 'roleAdmin', supervisor: 'roleSupervisor', technician: 'roleTechnician'
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private langSubject = new BehaviorSubject<Lang>(this.loadInitial());
  public lang$ = this.langSubject.asObservable();

  private loadInitial(): Lang {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'th';
  }

  get lang(): Lang {
    return this.langSubject.value;
  }

  get t(): Record<string, string> {
    return DICT[this.lang];
  }

  toggle(): void {
    this.set(this.lang === 'th' ? 'en' : 'th');
  }

  set(lang: Lang): void {
    this.langSubject.next(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  statusLabel(status: string): string {
    return STATUS_LABEL[this.lang][status] || status;
  }

  roleLabel(role: string): string {
    const key = ROLE_KEY[role];
    return key ? this.t[key] : role;
  }

  typeLabel(workType: string): string {
    if (this.lang === 'th') return workType;
    return TYPE_LABEL_EN[workType] || workType;
  }
}
