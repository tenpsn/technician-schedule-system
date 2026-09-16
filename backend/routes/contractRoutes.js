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

// Adds `months` calendar months to a 'YYYY-MM-DD' string, returning the same format.
// Clamps to the target month's last day instead of letting it overflow (plain
// Date.setUTCMonth would silently roll e.g. 31 Jan + 1 month into 3 Mar, since
// Feb has no 31st) — otherwise every later visit in the schedule keeps drifting.
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
//
// sequenceNo is renumbered across the WHOLE combined set (assigned + freshly
// generated) in chronological order, not just appended after assignedCount —
// appending after the count let an edit collide two different visits onto the
// same sequenceNo (e.g. an assigned "#2" and a newly generated "#2" for a
// different date) whenever an assigned visit wasn't first in the list.
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
    sendServerError(res);
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

// Move one MA visit to a different date (Supervisor/Admin only)
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

// Assign a technician to one MA visit — creates the actual work order (Supervisor/Admin only)
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

// Add a new contract (Supervisor/Admin only)
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

// Edit a contract (Supervisor/Admin only) — regenerates the MA visit schedule
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
    sendServerError(res);
  }
});

module.exports = router;
