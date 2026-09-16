const cron = require('node-cron');
const { Op } = require('sequelize');
const WorkOrder = require('../models/WorkOrder');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../config/logger');

// A work order's deadline is its planned end time on its planned date; jobs
// left without a specific end time are treated as due by the end of that day.
//
// Built entirely from UTC components rather than new Date(str) + setHours():
// plannedDate (a DATEONLY string) parses as UTC midnight per the JS spec, but
// setHours() sets the *local* time — mixing the two meant the computed
// deadline silently shifted by the server process's UTC offset whenever it
// wasn't running with TZ=Asia/Bangkok.
const deadlineOf = (order) => {
  const dateOnly = new Date(order.plannedDate);
  const y = dateOnly.getUTCFullYear();
  const m = dateOnly.getUTCMonth();
  const d = dateOnly.getUTCDate();
  if (order.plannedEndTime) {
    const [hours, minutes] = order.plannedEndTime.split(':').map(Number);
    return new Date(Date.UTC(y, m, d, hours, minutes, 0, 0));
  }
  return new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
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
      // One order's save/notification failure shouldn't abort the rest of the
      // batch — without this, a single bad record blocks every overdue order
      // that would have been processed after it, every run, until it's fixed.
      try {
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
      } catch (orderError) {
        logger.error(`Overdue check failed for order ${order.srNumber}: ${orderError.message}`);
      }
    }

    logger.info('✅ Overdue check completed');
  } catch (error) {
    logger.error(`Overdue check error: ${error.message}`);
  }
});
