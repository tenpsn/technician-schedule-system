const { Op } = require('sequelize');
const WorkOrder = require('../models/WorkOrder');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../config/logger');

const generateSRNumber = async () => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = await WorkOrder.count({
    where: { srNumber: { [Op.like]: `SR-${yearMonth}%` } }
  });
  return `SR-${yearMonth}-${String(count + 1).padStart(4, '0')}`;
};

// Creates a work order and notifies supervisors. Shared by the HTTP route
// and the LINE bot so SR numbering and the approval notification stay in sync.
const createWorkOrder = async ({ technician, customerName, customerLocation, workType,
  description, plannedDate, plannedStartTime, plannedEndTime }) => {
  const srNumber = await generateSRNumber();

  const workOrder = await WorkOrder.create({
    srNumber,
    technicianId: technician.id,
    customerName,
    customerLocation,
    workType,
    description,
    plannedDate,
    plannedStartTime,
    plannedEndTime,
    status: 'pending_approval'
  });

  const supervisors = await User.findAll({ where: { role: { [Op.in]: ['supervisor', 'admin'] } } });
  for (const sup of supervisors) {
    await Notification.create({
      recipientId: sup.id,
      type: 'approval_needed',
      title: '📋 รออนุมัติแผนงาน',
      message: `ช่าง ${technician.fullName} เสนอแผนงาน ${srNumber} - ${customerName}`,
      relatedWorkOrderId: workOrder.id
    });
  }

  logger.info(`Work order created: ${srNumber} by ${technician.username}`);
  return workOrder;
};

module.exports = { generateSRNumber, createWorkOrder };
