const cron = require('node-cron');
const { Op } = require('sequelize');
const WorkOrder = require('../models/WorkOrder');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../config/logger');

// A work order's deadline is its planned end time on its planned date; jobs
// left without a specific end time are treated as due by the end of that day.
const deadlineOf = (order) => {
  const deadline = new Date(order.plannedDate);
  if (order.plannedEndTime) {
    const [hours, minutes] = order.plannedEndTime.split(':').map(Number);
    deadline.setHours(hours, minutes, 0, 0);
  } else {
    deadline.setHours(23, 59, 59, 999);
  }
  return deadline;
};

// Run every 30 minutes — matches the web form's time picker, which only
// offers times on the same 30-minute grid (see time-picker.component.ts).
cron.schedule('*/30 * * * *', async () => {
  logger.info('🔄 Running overdue check...');

  const now = new Date();

  try {
    const candidates = await WorkOrder.findAll({
      where: {
        status: { [Op.in]: ['approved', 'in_progress', 'pending_approval'] }
      },
      include: [{ model: User, as: 'technician', attributes: ['id', 'fullName', 'email'] }]
    });

    const overdueOrders = candidates.filter((order) => deadlineOf(order) < now);

    logger.info(`Found ${overdueOrders.length} overdue orders`);

    for (const order of overdueOrders) {
      const days = Math.floor((now - deadlineOf(order)) / (1000 * 60 * 60 * 24));

      // Only update if not already marked as overdue or if days increased
      if (!order.isOverdue || order.overdueDays !== days) {
        order.isOverdue = true;
        order.overdueDays = days;
        order.status = 'overdue';
        await order.save();

        logger.info(`Order ${order.srNumber} marked as overdue (${days} days)`);

        // Notify technician
        await Notification.create({
          recipientId: order.technicianId,
          type: 'overdue',
          title: '⚠️ งานค้างเกินกำหนด',
          message: `งาน ${order.srNumber} (${order.customerName}) ค้าง ${days} วัน กรุณาอัปเดตสถานะหรือเลื่อนงาน`,
          relatedWorkOrderId: order.id
        });

        // Notify all supervisors
        const supervisors = await User.findAll({ where: { role: { [Op.in]: ['supervisor', 'admin'] } } });
        for (const sup of supervisors) {
          await Notification.create({
            recipientId: sup.id,
            type: 'overdue',
            title: '⚠️ แจ้งเตือนงานค้าง',
            message: `งาน ${order.srNumber} ของ ${order.technician.fullName} ค้าง ${days} วัน`,
            relatedWorkOrderId: order.id
          });
        }
      }
    }

    logger.info('✅ Overdue check completed');
  } catch (error) {
    logger.error(`Overdue check error: ${error.message}`);
  }
});
