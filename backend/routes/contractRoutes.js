const express = require('express');
const Contract = require('../models/Contract');
const Hospital = require('../models/Hospital');
const MaVisit = require('../models/MaVisit');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { createWorkOrder } = require('../services/workOrderService');
const { sendServerError } = require('../utils/httpErrors');
const logger = require('../config/logger');
const { nextBusinessDay } = require('../utils/thaiHolidays');

const VISIT_INCLUDE = [
  { model: WorkOrder, as: 'workOrder', include: [{ model: User, as: 'technician', attributes: ['id', 'fullName', 'username'] }] }
];

const router = express.Router();

function validateBody(body) {
  const { hospitalId, contractNumber, startDate, endDate, maIntervalMonths } = body;
  if (!hospitalId || !contractNumber || !startDate || !endDate || !maIntervalMonths) {
    return { code: 'contract_fields_required', message: 'Please provide all contract fields' };
  }
  const interval = parseInt(maIntervalMonths);
  if (!Number.isInteger(interval) || interval < 1 || interval > 12) {
    return { code: 'ma_interval_range', message: 'MA interval must be between 1-12 months' };
  }
  if (endDate < startDate) {
    return { code: 'dateRangeError', message: 'End date must be after start date' };
  }
  return null;
}

// บวกจำนวนเดือนเข้ากับสตริงวันที่ปีเดือนวัน คืนค่ารูปแบบเดิม
// ถ้าวันเกินเดือนเป้าหมายจะปรับเป็นวันสุดท้ายของเดือนนั้นแทนปล่อยให้ล้นไปเดือนถัดไป กันวันที่ของ visit ถัดๆไปเพี้ยนสะสม
function addMonths(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const totalMonths = y * 12 + (m - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, daysInTargetMonth);
  const yyyy = targetYear;
  const mm = String(targetMonth + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// สร้างวันที่เข้า MA ทุกครั้งตั้งแต่ startDate ถึง endDate ห่างกันตาม intervalMonths จำนวนครั้งต่อปีขึ้นกับช่วงสัญญาจริง ไม่ได้ตั้งสมมติฐานว่าเป็นปีละ 12 เดือน
// ถ้าวันตกวันหยุดจะเลื่อนไปวันทำการถัดไป แต่คำนวณก้าวถัดไปจากวันที่ยังไม่เลื่อน กันวันที่ครั้งหลังๆ เพี้ยนสะสม
function generateVisitDates(startDate, endDate, intervalMonths) {
  const dates = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(nextBusinessDay(current));
    current = addMonths(current, intervalMonths);
  }
  return dates;
}

// สร้างตารางเข้า MA ใหม่ให้สัญญา visit ที่มอบหมายช่างแล้วคือ workOrderId มีค่า ถือเป็นงานจริงแล้วจะไม่ถูกลบทิ้ง มีแค่ placeholder ที่ยังไม่มอบหมายเท่านั้นที่ถูกแทนที่
// sequenceNo จะเรียงเลขใหม่ทั้งชุดตามลำดับวันที่ ไม่ใช่ต่อท้ายชุดเดิม กันเลขซ้ำกันเมื่อ visit ที่มอบหมายแล้วไม่ได้อยู่ลำดับแรกสุด
async function regenerateVisits(contractId, startDate, endDate, intervalMonths) {
  await MaVisit.destroy({ where: { contractId, workOrderId: null } });
  const assigned = await MaVisit.findAll({ where: { contractId } });
  const assignedDates = new Set(assigned.map((v) => v.scheduledDate));

  const dates = generateVisitDates(startDate, endDate, intervalMonths);
  const newDates = dates.filter((d) => !assignedDates.has(d));

  const combined = [
    ...assigned.map((v) => ({ id: v.id, scheduledDate: v.scheduledDate })),
    ...newDates.map((d) => ({ id: null, scheduledDate: d }))
  ].sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : a.scheduledDate > b.scheduledDate ? 1 : 0));

  await Promise.all(combined.map((item, i) => {
    const sequenceNo = i + 1;
    return item.id
      ? MaVisit.update({ sequenceNo }, { where: { id: item.id } })
      : MaVisit.create({ contractId, sequenceNo, scheduledDate: item.scheduledDate });
  }));
}

// ดึงรายการสัญญา กรองด้วย hospitalId ได้ถ้ามี
router.get('/', protect, async (req, res) => {
  try {
    const { hospitalId } = req.query;
    const where = hospitalId ? { hospitalId } : {};

    const contracts = await Contract.findAll({
      where,
      include: [{ model: Hospital, as: 'hospital' }],
      order: [['startDate', 'DESC']]
    });

    res.json(contracts);
  } catch (error) {
    logger.error(`Get contracts error: ${error.message}`);
    sendServerError(res);
  }
});

// ดึงตารางเข้า MA ของสัญญาหนึ่ง ถ้ายังไม่มีจะสร้างจากวันที่และช่วงเวลาของสัญญาให้อัตโนมัติ
// เพื่อให้สัญญาที่สร้างก่อนมีฟีเจอร์นี้ก็ยังมีตารางใช้งานได้
router.get('/:id/visits', protect, async (req, res) => {
  try {
    let visits = await MaVisit.findAll({
      where: { contractId: req.params.id },
      include: VISIT_INCLUDE,
      order: [['sequenceNo', 'ASC']]
    });

    if (visits.length === 0) {
      const contract = await Contract.findByPk(req.params.id);
      if (!contract) {
        return res.status(404).json({ code: 'contract_not_found', message: 'Contract not found' });
      }
      await regenerateVisits(contract.id, contract.startDate, contract.endDate, contract.maIntervalMonths);
      visits = await MaVisit.findAll({
        where: { contractId: req.params.id },
        include: VISIT_INCLUDE,
        order: [['sequenceNo', 'ASC']]
      });
    }

    res.json(visits);
  } catch (error) {
    logger.error(`Get MA visits error: ${error.message}`);
    sendServerError(res);
  }
});

// ย้ายวันเข้า MA ครั้งหนึ่ง สำหรับหัวหน้างานหรือ admin เท่านั้น
router.patch('/:id/visits/:visitId', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { scheduledDate } = req.body;
    if (!scheduledDate) {
      return res.status(400).json({ code: 'visit_date_required', message: 'Please provide a date' });
    }

    const visit = await MaVisit.findOne({ where: { id: req.params.visitId, contractId: req.params.id } });
    if (!visit) {
      return res.status(404).json({ code: 'ma_visit_not_found', message: 'MA visit not found' });
    }
    if (visit.workOrderId) {
      return res.status(400).json({ code: 'visit_already_assigned_reschedule_hint', message: 'This visit is already assigned — reschedule it from the job detail page instead' });
    }

    visit.scheduledDate = scheduledDate;
    await visit.save();
    logger.info(`MA visit rescheduled: contract ${req.params.id}, visit #${visit.sequenceNo} -> ${scheduledDate}`);
    res.json(visit);
  } catch (error) {
    logger.error(`Update MA visit error: ${error.message}`);
    sendServerError(res);
  }
});

// มอบหมายช่างให้ MA ครั้งหนึ่ง จะสร้างใบงานจริงด้วย สำหรับหัวหน้างานหรือ admin เท่านั้น
router.post('/:id/visits/:visitId/assign', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { technicianId } = req.body;
    if (!technicianId) {
      return res.status(400).json({ code: 'technician_required', message: 'Please select a technician' });
    }

    const visit = await MaVisit.findOne({ where: { id: req.params.visitId, contractId: req.params.id } });
    if (!visit) {
      return res.status(404).json({ code: 'ma_visit_not_found', message: 'MA visit not found' });
    }
    if (visit.workOrderId) {
      return res.status(400).json({ code: 'visit_already_assigned', message: 'This MA visit has already been assigned' });
    }

    const technician = await User.findByPk(technicianId);
    if (!technician) {
      return res.status(404).json({ code: 'user_not_found', message: 'User not found' });
    }

    const contract = await Contract.findByPk(req.params.id, { include: [{ model: Hospital, as: 'hospital' }] });
    if (!contract) {
      return res.status(404).json({ code: 'contract_not_found', message: 'Contract not found' });
    }

    const workOrder = await createWorkOrder({
      technician,
      customerName: contract.hospital.name,
      customerLocation: contract.hospital.address,
      workType: 'MA',
      description: `MA ครั้งที่ ${visit.sequenceNo} ตามสัญญา ${contract.contractNumber}`,
      plannedDate: visit.scheduledDate,
      plannedStartTime: '',
      plannedEndTime: ''
    });

    visit.workOrderId = workOrder.id;
    await visit.save();
    await visit.reload({ include: VISIT_INCLUDE });

    logger.info(`MA visit assigned: contract ${contract.id} visit #${visit.sequenceNo} -> ${technician.username} (${workOrder.srNumber})`);
    res.status(201).json(visit);
  } catch (error) {
    logger.error(`Assign MA visit error: ${error.message}`);
    sendServerError(res);
  }
});

// เพิ่มสัญญาใหม่ สำหรับหัวหน้างานหรือ admin เท่านั้น
router.post('/', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { hospitalId, contractNumber, startDate, endDate, maIntervalMonths } = req.body;
    const validationError = validateBody(req.body);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      return res.status(404).json({ code: 'hospital_not_found', message: 'Hospital not found' });
    }

    const interval = parseInt(maIntervalMonths);
    const contract = await Contract.create({
      hospitalId,
      contractNumber: contractNumber.trim(),
      startDate,
      endDate,
      maIntervalMonths: interval
    });
    await regenerateVisits(contract.id, startDate, endDate, interval);
    await contract.reload({ include: [{ model: Hospital, as: 'hospital' }] });

    logger.info(`Contract added: ${contract.contractNumber} (${hospital.name})`);
    res.status(201).json(contract);
  } catch (error) {
    logger.error(`Create contract error: ${error.message}`);
    sendServerError(res);
  }
});

// แก้ไขสัญญา สำหรับหัวหน้างานหรือ admin เท่านั้น จะสร้างตารางเข้า MA ใหม่ด้วย
router.patch('/:id', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { hospitalId, contractNumber, startDate, endDate, maIntervalMonths } = req.body;
    const validationError = validateBody(req.body);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const contract = await Contract.findByPk(req.params.id);
    if (!contract) {
      return res.status(404).json({ code: 'contract_not_found', message: 'Contract not found' });
    }

    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      return res.status(404).json({ code: 'hospital_not_found', message: 'Hospital not found' });
    }

    const interval = parseInt(maIntervalMonths);
    const scheduleChanged = contract.startDate !== startDate || contract.endDate !== endDate
      || contract.maIntervalMonths !== interval;

    contract.hospitalId = hospitalId;
    contract.contractNumber = contractNumber.trim();
    contract.startDate = startDate;
    contract.endDate = endDate;
    contract.maIntervalMonths = interval;
    await contract.save();
    // สร้างตารางเข้า MA ใหม่เฉพาะตอนวันที่หรือช่วงเวลาเปลี่ยนจริง
    // ไม่งั้นแค่แก้เลขที่สัญญาจะไปลบวันที่ที่ผู้ใช้เคยเลื่อนเองทิ้งโดยไม่ตั้งใจ
    if (scheduleChanged) {
      await regenerateVisits(contract.id, startDate, endDate, interval);
    }
    await contract.reload({ include: [{ model: Hospital, as: 'hospital' }] });

    logger.info(`Contract updated: ${contract.contractNumber} (${hospital.name})`);
    res.json(contract);
  } catch (error) {
    logger.error(`Update contract error: ${error.message}`);
    sendServerError(res);
  }
});

module.exports = router;
