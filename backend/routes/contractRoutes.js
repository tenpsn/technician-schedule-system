const express = require('express');
const Contract = require('../models/Contract');
const Hospital = require('../models/Hospital');
const MaVisit = require('../models/MaVisit');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { createWorkOrder } = require('../services/workOrderService');
const logger = require('../config/logger');
const { nextBusinessDay } = require('../utils/thaiHolidays');

const VISIT_INCLUDE = [
  { model: WorkOrder, as: 'workOrder', include: [{ model: User, as: 'technician', attributes: ['id', 'fullName', 'username'] }] }
];

const router = express.Router();

function validateBody(body) {
  const { hospitalId, contractNumber, startDate, endDate, maIntervalMonths } = body;
  if (!hospitalId || !contractNumber || !startDate || !endDate || !maIntervalMonths) {
    return 'กรุณากรอกข้อมูลสัญญาให้ครบถ้วน';
  }
  const interval = parseInt(maIntervalMonths);
  if (!Number.isInteger(interval) || interval < 1 || interval > 12) {
    return 'รอบ MA ต้องเป็นจำนวนเดือนระหว่าง 1-12';
  }
  if (endDate < startDate) {
    return 'วันที่สิ้นสุดต้องอยู่หลังวันที่เริ่ม';
  }
  return null;
}

// Adds `months` calendar months to a 'YYYY-MM-DD' string, returning the same format.
function addMonths(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCMonth(date.getUTCMonth() + months);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Every MA visit date from startDate to endDate (inclusive), `intervalMonths` apart.
// The total count — and so the "times per year" — falls out of the contract's own
// date range rather than an assumed 12-month year. Each date is rolled forward to
// the next business day when it lands on a weekend or public holiday; stepping is
// based on the un-shifted date so that adjustment doesn't drift later occurrences.
function generateVisitDates(startDate, endDate, intervalMonths) {
  const dates = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(nextBusinessDay(current));
    current = addMonths(current, intervalMonths);
  }
  return dates;
}

// Regenerates the MA visit schedule for a contract. Visits already assigned to a
// technician (workOrderId set) are real jobs now — they're left untouched instead
// of being wiped out, and only the still-unassigned placeholders are replaced.
async function regenerateVisits(contractId, startDate, endDate, intervalMonths) {
  await MaVisit.destroy({ where: { contractId, workOrderId: null } });
  const assignedCount = await MaVisit.count({ where: { contractId } });
  const dates = generateVisitDates(startDate, endDate, intervalMonths);
  if (dates.length === 0) return;
  await MaVisit.bulkCreate(dates.map((scheduledDate, i) => ({
    contractId,
    sequenceNo: assignedCount + i + 1,
    scheduledDate
  })));
}

// List contracts (optionally filtered by hospitalId)
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
    res.status(500).json({ message: error.message });
  }
});

// List the MA visit schedule for one contract — backfills it from the
// contract's dates/interval the first time it's requested, so contracts
// created before this feature existed still get a schedule.
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
        return res.status(404).json({ message: 'ไม่พบสัญญานี้' });
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
    res.status(500).json({ message: error.message });
  }
});

// Move one MA visit to a different date (Supervisor/Admin only)
router.patch('/:id/visits/:visitId', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { scheduledDate } = req.body;
    if (!scheduledDate) {
      return res.status(400).json({ message: 'กรุณาระบุวันที่' });
    }

    const visit = await MaVisit.findOne({ where: { id: req.params.visitId, contractId: req.params.id } });
    if (!visit) {
      return res.status(404).json({ message: 'ไม่พบรอบ MA นี้' });
    }
    if (visit.workOrderId) {
      return res.status(400).json({ message: 'รอบนี้มอบหมายงานแล้ว กรุณาเลื่อนงานผ่านหน้ารายละเอียดงานแทน' });
    }

    visit.scheduledDate = scheduledDate;
    await visit.save();
    logger.info(`MA visit rescheduled: contract ${req.params.id}, visit #${visit.sequenceNo} -> ${scheduledDate}`);
    res.json(visit);
  } catch (error) {
    logger.error(`Update MA visit error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// Assign a technician to one MA visit — creates the actual work order (Supervisor/Admin only)
router.post('/:id/visits/:visitId/assign', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { technicianId } = req.body;
    if (!technicianId) {
      return res.status(400).json({ message: 'กรุณาเลือกช่างผู้รับผิดชอบ' });
    }

    const visit = await MaVisit.findOne({ where: { id: req.params.visitId, contractId: req.params.id } });
    if (!visit) {
      return res.status(404).json({ message: 'ไม่พบรอบ MA นี้' });
    }
    if (visit.workOrderId) {
      return res.status(400).json({ message: 'รอบ MA นี้มอบหมายงานไปแล้ว' });
    }

    const technician = await User.findByPk(technicianId);
    if (!technician) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งานนี้' });
    }

    const contract = await Contract.findByPk(req.params.id, { include: [{ model: Hospital, as: 'hospital' }] });
    if (!contract) {
      return res.status(404).json({ message: 'ไม่พบสัญญานี้' });
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
    res.status(500).json({ message: error.message });
  }
});

// Add a new contract (Supervisor/Admin only)
router.post('/', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { hospitalId, contractNumber, startDate, endDate, maIntervalMonths } = req.body;
    const validationError = validateBody(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: 'ไม่พบโรงพยาบาลนี้' });
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
    res.status(500).json({ message: error.message });
  }
});

// Edit a contract (Supervisor/Admin only) — regenerates the MA visit schedule
router.patch('/:id', protect, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { hospitalId, contractNumber, startDate, endDate, maIntervalMonths } = req.body;
    const validationError = validateBody(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const contract = await Contract.findByPk(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: 'ไม่พบสัญญานี้' });
    }

    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: 'ไม่พบโรงพยาบาลนี้' });
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
    // Only reshuffle the MA visit schedule when the dates/interval actually
    // moved — otherwise an edit to e.g. the contract number would silently
    // wipe out any visit dates the user had manually rescheduled.
    if (scheduleChanged) {
      await regenerateVisits(contract.id, startDate, endDate, interval);
    }
    await contract.reload({ include: [{ model: Hospital, as: 'hospital' }] });

    logger.info(`Contract updated: ${contract.contractNumber} (${hospital.name})`);
    res.json(contract);
  } catch (error) {
    logger.error(`Update contract error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
