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
    navSchedule: 'ตารางงาน', navMySchedule: 'ตารางงานของฉัน', navAdd: 'เพิ่มงาน', navJobs: 'งาน',
    navCancelled: 'งานที่ยกเลิก', navHospitals: 'ลูกค้า', navDashboard: 'แดชบอร์ดช่าง',
    team: 'ทีมช่าง', clearFilter: 'ล้างตัวกรอง', queueTitle: 'รออนุมัติแผนงาน',
    myPendingTitle: 'งานของฉันที่รออนุมัติ',
    viewMonth: 'ปฏิทินเดือน', viewWeek: 'สัปดาห์', viewDay: 'ไทม์ไลน์รายวัน',
    jobsUnit: 'งาน', hoursUnit: 'ชม.', techLoad: 'ชั่วโมงงานเดือนนี้', statQueued: 'รออนุมัติ',
    scopeAll: 'งานของทุกคน', scopeMine: 'งานของฉัน',
    jobDetail: 'รายละเอียดงาน', back: 'กลับ', planning: 'Planning (แผนงาน)', planDate: 'วันที่วางแผน',
    timeLabel: 'เวลา', statusLabel: 'สถานะงาน', customer: 'ลูกค้า', site: 'สถานที่', jobType: 'ประเภทงาน',
    owner: 'ช่างผู้รับผิดชอบ', postpone: 'เลื่อนงาน', cancelJob: 'ยกเลิกงาน', approvePlan: 'อนุมัติแผนงาน',
    updateStatus: 'บันทึกงานจริง', createdBy: 'ผู้สร้างงาน', addJob: 'เพิ่มงานใหม่',
    uploadPhotos: 'อัปโหลดรูป', photosLabel: 'รูปถ่ายหน้างาน', selectPhotos: 'เลือกรูป',
    noPhotosSelected: 'ยังไม่ได้เลือกรูป', uploading: 'กำลังอัปโหลด…', uploaded: 'อัปโหลดแล้ว ✓',
    toastPhotosUploaded: 'อัปโหลดรูปสำเร็จ', toastNeedPhotos: 'กรุณาเลือกรูปอย่างน้อย 1 รูป',
    deletePhotoTitle: 'ลบรูปนี้?', toastPhotoDeleted: 'ลบรูปแล้ว',
    customerInfo: 'ข้อมูลลูกค้า', jobInfo: 'รายละเอียดงาน',
    hospitalName: 'ชื่อลูกค้า/โรงพยาบาล', selectHospital: '-- เลือกโรงพยาบาล --', selectType: '-- เลือกประเภทงาน --',
    sitePh: 'เช่น สูงเนิน โคราช', jobDesc: 'รายละเอียด / อาการที่แจ้ง', jobDescPh: 'ระบุอาการ อุปกรณ์ และสิ่งที่ต้องเตรียม',
    startTime: 'เวลาเริ่ม', endTime: 'เวลาสิ้นสุด', saveJob: 'บันทึกงาน', cancel: 'ยกเลิก',
    cancelReport: 'รายงานงานที่ยกเลิก', month: 'เดือน', year: 'ปี', foundItems: 'พบ', items: 'รายการ',
    colSr: 'SR Number', colHospital: 'ลูกค้า', colType: 'ประเภท', colTech: 'ช่าง', colPlan: 'วันที่วางแผน',
    colBy: 'ผู้ยกเลิก', colAt: 'เวลายกเลิก', colReason: 'เหตุผล',
    hospitalSettings: 'ตั้งค่ารายชื่อโรงพยาบาล', hospitalAddress: 'ที่อยู่', hospitalNamePh: 'เช่น สูงเนิน',
    hospitalAddressPh: 'เช่น 111 ถ.มิตรภาพ ต.ในเมือง อ.เมือง จ.นครราชสีมา', addHospital: 'เพิ่มโรงพยาบาล', searchList: 'ค้นหาในรายการ...', delete: 'ลบ',
    hospitalFacilityCode: 'รหัสสถานพยาบาล', hospitalFacilityCodePh: 'เช่น 12345',
    contractSettings: 'สัญญา', contractNumber: 'เลขที่สัญญา', contractNumberPh: 'เช่น สญ-2569-001',
    contractStart: 'วันที่เริ่ม', contractEnd: 'วันที่สิ้นสุด', contractMaInterval: 'รอบ MA (บำรุงรักษา)',
    dateRangeError: 'วันที่สิ้นสุดต้องอยู่หลังวันที่เริ่ม',
    contractMaIntervalPh: 'เช่น 3', contractMaIntervalSuffix: 'เดือน/ครั้ง',
    addContract: 'เพิ่มสัญญา', editContractTitle: 'แก้ไขข้อมูลสัญญา',
    toastContract: 'เพิ่มสัญญาแล้ว', toastContractUpdated: 'บันทึกการแก้ไขแล้ว',
    contractVisits: 'รอบ MA', contractVisitsTitle: 'กำหนดการ MA', contractVisitSeq: 'ครั้งที่',
    contractNoVisits: 'ไม่มีรอบ MA ในช่วงสัญญานี้', toastVisitUpdated: 'บันทึกวันที่แล้ว', close: 'ปิด',
    contractStatus: 'สถานะ', contractStatusActive: 'ใช้งานอยู่', contractStatusExpiring: 'ใกล้หมดอายุ', contractStatusExpired: 'หมดอายุแล้ว',
    contractAssign: 'มอบหมายงาน', contractSelectTechnician: '-- เลือกช่าง --', contractViewDetail: 'ดูรายละเอียด',
    contractVisitDate: 'วันที่', contractVisitTech: 'ช่างผู้รับผิดชอบ', contractVisitPending: 'รอมอบหมาย',
    toastVisitAssigned: 'มอบหมายงานแล้ว',
    edit: 'แก้ไข', editHospitalTitle: 'แก้ไขข้อมูลโรงพยาบาล', toastHospitalUpdated: 'บันทึกการแก้ไขแล้ว',
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
    approvalNoteLabel: 'หมายเหตุ',
    approvalHistoryLabel: 'ประวัติการอนุมัติ',
    today: 'วันนี้', prev: 'ก่อนหน้า', next: 'ถัดไป', noResults: 'ไม่พบข้อมูล', loading: 'กำลังโหลด...',
    saving: 'กำลังบันทึก…', saved: 'บันทึกแล้ว ✓', approving: 'กำลังอนุมัติ…', approvedDone: 'อนุมัติแล้ว ✓',
    cancelling: 'กำลังยกเลิก…', cancelledDone: 'ยกเลิกแล้ว ✓', postponing: 'กำลังเลื่อน…', postponedDone: 'เลื่อนแล้ว ✓',
    approveTitle: 'อนุมัติแผนงาน', approveBody: 'เมื่ออนุมัติแล้ว งานจะถูกยืนยันเข้าตารางของช่างและแจ้งเตือนผู้เกี่ยวข้อง',
    reviewEdit: 'แก้ไขก่อน', yesConfirm: 'ตกลง ยืนยัน', confirmStep: 'ตรวจสอบก่อนยืนยัน',
    irreversible: 'การดำเนินการนี้ไม่สามารถย้อนกลับได้', confirmCancelQ: 'ยืนยันการยกเลิกงาน',
    toastLogin: 'เข้าสู่ระบบสำเร็จ', toastSaved: 'บันทึกงานใหม่สำเร็จ', toastApproved: 'อนุมัติแผนงานสำเร็จ',
    invalidCredentials: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
    remainingAttemptsPrefix: 'เหลืออีก', remainingAttemptsSuffix: 'ครั้งก่อนถูกล็อกชั่วคราว',
    loginLockedPrefix: 'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณาลองใหม่อีกครั้งใน', loginLockedSuffix: 'นาที',
    accountDeactivated: 'บัญชีนี้ถูกระงับการใช้งาน', signInFailed: 'เข้าสู่ระบบไม่สำเร็จ',
    serverError: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง',
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
    dashboardTitle: 'แดชบอร์ดช่าง', colAssigned: 'งานที่ได้รับ', colCancelRate: 'อัตรายกเลิก',
    colRescheduled: 'เลื่อนงาน', colHoursWorked: 'ชั่วโมงที่ทำ', colDaysWorked: 'วันที่ทำงาน',
    selectTechHint: 'คลิกชื่อช่างเพื่อดูรายละเอียด', jobTypeBreakdown: 'สัดส่วนประเภทงาน',
    dailyCalendar: 'วันที่ทำงานในเดือนนี้', jobList: 'รายการงานทั้งหมด', noJobsThisMonth: 'ไม่มีงานในเดือนนี้',
    noJobsThisYear: 'ไม่มีงานในปีนี้',
    colDuration: 'ระยะเวลา', viewByMonth: 'รายเดือน', viewByYear: 'รายปี',
    monthlyBreakdown: 'สรุปรายเดือน',
    scopeCompleted: 'จากงานที่เสร็จสิ้น', scopeCancelled: 'จากงานที่ยกเลิกแล้ว',
    scopeOverdue: 'จากงานที่ค้างเกินกำหนด', scopeRescheduled: 'จากงานที่เคยเลื่อน',
    rescheduledCountLabel: 'เลื่อน', timesWord: 'ครั้ง', totalLabel: 'รวมทุกคน',
    repairStatusLabel: 'สถานะการซ่อม', repairDoneYes: 'ซ่อมเสร็จแล้ว', repairDoneNo: 'ยังไม่เสร็จ',
    repairIncompleteReason: 'สาเหตุที่ยังไม่เสร็จ', repairIncompleteReasonPh: 'ระบุสาเหตุที่งานซ่อมยังไม่เสร็จ',
    installationDelivered: 'ส่งมอบเครื่องให้ลูกค้าแล้ว',
    toastNeedRepairStatus: 'กรุณาเลือกสถานะการซ่อม', toastNeedRepairReason: 'กรุณาระบุสาเหตุที่ยังซ่อมไม่เสร็จ',
    deliveredYes: 'ส่งมอบแล้ว', deliveredNo: 'ยังไม่ส่งมอบ',
    // Backend error `code` translations — see I18nService.errorMessage()
    genericError: 'เกิดข้อผิดพลาด',
    missing_required_fields: 'กรุณากรอกข้อมูลให้ครบถ้วน',
    username_exists: 'มีชื่อผู้ใช้นี้อยู่แล้ว',
    missing_login_fields: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน',
    user_not_found: 'ไม่พบผู้ใช้งานนี้',
    cannot_deactivate_self: 'ไม่สามารถระงับการใช้งานบัญชีของตัวเองได้',
    work_order_not_found: 'ไม่พบงานนี้',
    not_authorized_view_order: 'ไม่มีสิทธิ์ดูงานนี้',
    not_authorized: 'ไม่มีสิทธิ์ดำเนินการนี้',
    not_authorized_reschedule: 'ไม่มีสิทธิ์เลื่อนงานนี้',
    not_authorized_cancel: 'ไม่มีสิทธิ์ยกเลิกงานนี้',
    reschedule_fields_required: 'กรุณาระบุวันที่ใหม่และเหตุผล',
    photos_required: 'กรุณาเลือกรูปอย่างน้อย 1 รูป',
    photo_invalid: 'ไฟล์รูปไม่ถูกต้องหรือเสียหาย',
    photo_to_delete_required: 'กรุณาระบุรูปที่ต้องการลบ',
    photo_not_found_on_order: 'ไม่พบรูปนี้ในงาน',
    cancel_reason_required: 'กรุณาระบุเหตุผลการยกเลิก',
    work_order_cancelled: 'ยกเลิกงานสำเร็จ',
    hospital_fields_required: 'กรุณากรอกชื่อโรงพยาบาลและที่อยู่',
    hospital_not_found: 'ไม่พบโรงพยาบาลนี้',
    hospital_has_contracts: 'ไม่สามารถลบได้ เนื่องจากมีสัญญาผูกกับโรงพยาบาลนี้อยู่',
    contract_not_found: 'ไม่พบสัญญานี้',
    contract_fields_required: 'กรุณากรอกข้อมูลสัญญาให้ครบถ้วน',
    ma_interval_range: 'รอบ MA ต้องเป็นจำนวนเดือนระหว่าง 1-12',
    visit_date_required: 'กรุณาระบุวันที่',
    ma_visit_not_found: 'ไม่พบรอบ MA นี้',
    visit_already_assigned_reschedule_hint: 'รอบนี้มอบหมายงานแล้ว กรุณาเลื่อนงานผ่านหน้ารายละเอียดงานแทน',
    technician_required: 'กรุณาเลือกช่างผู้รับผิดชอบ',
    visit_already_assigned: 'รอบ MA นี้มอบหมายงานไปแล้ว',
    notification_not_found: 'ไม่พบการแจ้งเตือนนี้',
    not_pending_approval: 'งานนี้ไม่ได้อยู่ในสถานะรออนุมัติ',
    actual_description_required: 'กรุณากรอกรายละเอียดงานที่ทำได้จริง',
    cannot_cancel_status: 'ไม่สามารถยกเลิกงานที่มีสถานะ "{status}" ได้',
    repair_status_required: 'กรุณาเลือกสถานะการซ่อม',
    repair_incomplete_reason_required: 'กรุณาระบุสาเหตุที่ยังซ่อมไม่เสร็จ',
    current_password_required: 'กรุณากรอกรหัสผ่านปัจจุบันเพื่อเปลี่ยนรหัสผ่าน',
    current_password_incorrect: 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
  },
  en: {
    brand: 'Technician System', langShort: 'EN', themeBtn: 'Toggle light / dark',
    login: 'Sign in', logout: 'Sign out', username: 'Username', password: 'Password',
    loginLead: 'Monthly, weekly and daily service schedules for medical equipment teams and dispatchers.',
    access: 'Access levels', accessAll: 'Administrator and lead technician see every technician’s jobs',
    accessOwn: 'Technician sees only their own assigned jobs',
    searchPh: 'Search SR / customer / job type',
    navSchedule: 'Schedule', navMySchedule: 'My schedule', navAdd: 'New job', navJobs: 'Jobs',
    navCancelled: 'Cancelled jobs', navHospitals: 'Customers', navDashboard: 'Tech dashboard',
    team: 'Technicians', clearFilter: 'Clear filters', queueTitle: 'Pending approval',
    myPendingTitle: 'My jobs pending approval',
    viewMonth: 'Month', viewWeek: 'Week', viewDay: 'Day timeline',
    jobsUnit: 'jobs', hoursUnit: 'h', techLoad: 'Hours scheduled this month', statQueued: 'Pending',
    scopeAll: 'All technicians', scopeMine: 'My jobs only',
    jobDetail: 'Job detail', back: 'Back', planning: 'Planning', planDate: 'Planned date',
    timeLabel: 'Time', statusLabel: 'Status', customer: 'Customer', site: 'Site', jobType: 'Job type',
    owner: 'Assigned technician', postpone: 'Postpone', cancelJob: 'Cancel job', approvePlan: 'Approve plan',
    updateStatus: 'Log completed work', createdBy: 'Created by', addJob: 'New job',
    uploadPhotos: 'Upload photos', photosLabel: 'Job site photos', selectPhotos: 'Choose photos',
    noPhotosSelected: 'No photos selected', uploading: 'Uploading…', uploaded: 'Uploaded ✓',
    toastPhotosUploaded: 'Photos uploaded', toastNeedPhotos: 'Please select at least 1 photo',
    deletePhotoTitle: 'Delete this photo?', toastPhotoDeleted: 'Photo deleted',
    customerInfo: 'Customer', jobInfo: 'Job details',
    hospitalName: 'Customer / hospital name', selectHospital: '-- select hospital --', selectType: '-- select job type --',
    sitePh: 'e.g. Sung Noen, Korat', jobDesc: 'Description / reported issue', jobDescPh: 'Symptoms, equipment and parts to prepare',
    startTime: 'Start', endTime: 'End', saveJob: 'Save job', cancel: 'Cancel',
    cancelReport: 'Cancelled jobs report', month: 'Month', year: 'Year', foundItems: 'Found', items: 'records',
    colSr: 'SR Number', colHospital: 'Customer', colType: 'Type', colTech: 'Technician', colPlan: 'Planned date',
    colBy: 'Cancelled by', colAt: 'Cancelled at', colReason: 'Reason',
    hospitalSettings: 'Hospital list settings', hospitalAddress: 'Address', hospitalNamePh: 'e.g. Sung Noen',
    hospitalAddressPh: 'e.g. 111 Mittraphap Rd, Nai Mueang, Mueang, Nakhon Ratchasima', addHospital: 'Add hospital', searchList: 'Search list...', delete: 'Delete',
    hospitalFacilityCode: 'Facility code', hospitalFacilityCodePh: 'e.g. 12345',
    contractSettings: 'Contract', contractNumber: 'Contract number', contractNumberPh: 'e.g. CT-2026-001',
    contractStart: 'Start date', contractEnd: 'End date', contractMaInterval: 'MA (maintenance) interval',
    dateRangeError: 'End date must be after start date',
    contractMaIntervalPh: 'e.g. 3', contractMaIntervalSuffix: 'months/visit',
    addContract: 'Add contract', editContractTitle: 'Edit contract',
    toastContract: 'Contract added', toastContractUpdated: 'Changes saved',
    contractVisits: 'MA visits', contractVisitsTitle: 'MA schedule', contractVisitSeq: 'Visit #',
    contractNoVisits: 'No MA visits fall within this contract', toastVisitUpdated: 'Date saved', close: 'Close',
    contractAssign: 'Assign', contractSelectTechnician: '-- select technician --', contractViewDetail: 'View detail',
    contractVisitDate: 'Date', contractVisitTech: 'Technician', contractVisitPending: 'Pending assignment',
    toastVisitAssigned: 'Job assigned',
    contractStatus: 'Status', contractStatusActive: 'Active', contractStatusExpiring: 'Expiring soon', contractStatusExpired: 'Expired',
    edit: 'Edit', editHospitalTitle: 'Edit hospital', toastHospitalUpdated: 'Changes saved',
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
    approvalNoteLabel: 'Note',
    approvalHistoryLabel: 'Approval history',
    today: 'Today', prev: 'Prev', next: 'Next', noResults: 'No results', loading: 'Loading...',
    saving: 'Saving…', saved: 'Saved ✓', approving: 'Approving…', approvedDone: 'Approved ✓',
    cancelling: 'Cancelling…', cancelledDone: 'Cancelled ✓', postponing: 'Rescheduling…', postponedDone: 'Rescheduled ✓',
    approveTitle: 'Approve plan', approveBody: 'Once approved the job is locked into the technician’s schedule and everyone involved is notified.',
    reviewEdit: 'Edit first', yesConfirm: 'Yes, confirm', confirmStep: 'Review before confirming',
    irreversible: 'This action cannot be undone', confirmCancelQ: 'Confirm cancellation of',
    toastLogin: 'Signed in', toastSaved: 'New job saved', toastApproved: 'Plan approved',
    invalidCredentials: 'Incorrect username or password. Please check and try again.',
    remainingAttemptsPrefix: '', remainingAttemptsSuffix: 'attempt(s) left before lockout',
    loginLockedPrefix: 'Too many failed attempts. Try again in', loginLockedSuffix: 'minute(s).',
    accountDeactivated: 'Account is deactivated', signInFailed: 'Sign in failed',
    serverError: 'Something went wrong on the server. Please try again.',
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
    dashboardTitle: 'Technician dashboard', colAssigned: 'Assigned', colCancelRate: 'Cancel rate',
    colRescheduled: 'Rescheduled', colHoursWorked: 'Hours worked', colDaysWorked: 'Days worked',
    selectTechHint: 'Click a technician to see detail', jobTypeBreakdown: 'Job type breakdown',
    dailyCalendar: 'Days worked this month', jobList: 'All jobs', noJobsThisMonth: 'No jobs this month',
    noJobsThisYear: 'No jobs this year',
    colDuration: 'Duration', viewByMonth: 'Monthly', viewByYear: 'Yearly',
    monthlyBreakdown: 'Monthly breakdown',
    scopeCompleted: 'from completed jobs', scopeCancelled: 'from cancelled jobs',
    scopeOverdue: 'from overdue jobs', scopeRescheduled: 'from rescheduled jobs',
    rescheduledCountLabel: 'moved', timesWord: 'times', totalLabel: 'Total (all)',
    repairStatusLabel: 'Repair status', repairDoneYes: 'Repair completed', repairDoneNo: 'Not completed yet',
    repairIncompleteReason: 'Reason not completed', repairIncompleteReasonPh: 'State why the repair is not finished',
    installationDelivered: 'Delivered to customer',
    toastNeedRepairStatus: 'Please select the repair status', toastNeedRepairReason: 'Please state the reason it is not finished',
    deliveredYes: 'Delivered', deliveredNo: 'Not delivered yet',
    // Backend error `code` translations — see I18nService.errorMessage()
    genericError: 'An error occurred',
    missing_required_fields: 'Please provide all required fields',
    username_exists: 'Username already exists',
    missing_login_fields: 'Please provide username and password',
    user_not_found: 'User not found',
    cannot_deactivate_self: 'You cannot deactivate your own account',
    work_order_not_found: 'Work order not found',
    not_authorized_view_order: 'Not authorized to view this order',
    not_authorized: 'Not authorized',
    not_authorized_reschedule: 'Not authorized to reschedule',
    not_authorized_cancel: 'Not authorized to cancel this job',
    reschedule_fields_required: 'New date and reason are required',
    photos_required: 'Please select at least 1 photo',
    photo_invalid: 'Photo file is invalid or corrupted',
    photo_to_delete_required: 'Please specify which photo to delete',
    photo_not_found_on_order: 'Photo not found on this work order',
    cancel_reason_required: 'Please state a reason for cancelling',
    work_order_cancelled: 'Cancelled successfully',
    hospital_fields_required: 'Please provide hospital name and address',
    hospital_not_found: 'Hospital not found',
    hospital_has_contracts: 'Cannot delete: contracts are linked to this hospital',
    contract_not_found: 'Contract not found',
    contract_fields_required: 'Please provide all contract fields',
    ma_interval_range: 'MA interval must be between 1-12 months',
    visit_date_required: 'Please provide a date',
    ma_visit_not_found: 'MA visit not found',
    visit_already_assigned_reschedule_hint: 'This visit is already assigned — reschedule it from the job detail page instead',
    technician_required: 'Please select a technician',
    visit_already_assigned: 'This MA visit has already been assigned',
    notification_not_found: 'Notification not found',
    not_pending_approval: 'Work order is not pending approval',
    actual_description_required: 'Actual description is required',
    cannot_cancel_status: 'Cannot cancel a work order with status "{status}"',
    repair_status_required: 'Please select the repair status',
    repair_incomplete_reason_required: 'Please state why the repair is not finished',
    current_password_required: 'Current password is required to change password',
    current_password_incorrect: 'Current password is incorrect',
  }
};

const STATUS_LABEL: Record<Lang, Record<string, string>> = {
  th: {
    draft: 'ร่าง', pending_approval: 'รออนุมัติ', approved: 'อนุมัติแล้ว', in_progress: 'กำลังดำเนินการ',
    completed: 'เสร็จสิ้น', overdue: 'ค้างเกินกำหนด', cancelled: 'ยกเลิกแล้ว', rescheduled: 'เลื่อนแล้ว'
  },
  en: {
    draft: 'Draft', pending_approval: 'Pending', approved: 'Approved', in_progress: 'In progress',
    completed: 'Completed', overdue: 'Overdue', cancelled: 'Cancelled', rescheduled: 'Rescheduled'
  }
};

const TYPE_LABEL_EN: Record<string, string> = {
  'MA': 'MA (Preventive)', 'ติดตั้ง': 'Installation', 'ซ่อม': 'Repair', 'อื่นๆ': 'Other'
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

  // Backend sends a language-neutral `code` (+ optional `data` for messages
  // with a dynamic value, e.g. a status name) instead of a pre-built string,
  // so this can render the error in whichever language the user has selected
  // rather than whatever language happened to be hardcoded into that route.
  errorMessage(err: any, fallback?: string): string {
    const code = err?.error?.code;
    if (code && this.t[code]) {
      let msg = this.t[code];
      const data = err?.error?.data;
      if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
          const display = key === 'status' ? this.statusLabel(String(value)) : String(value);
          msg = msg.split(`{${key}}`).join(display);
        }
      }
      return msg;
    }
    return err?.error?.message || fallback || this.t['genericError'];
  }
}
