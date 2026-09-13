const cron = require('node-cron');
const { Op } = require('sequelize');
const WorkOrder = require('../models/WorkOrder');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../config/logger');

// Run every day at 8:00 AM
cron.schedule('0 8 * * *', async () => {
  logger.info('🔄 Running overdue check...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const overdueOrders = await WorkOrder.findAll({
      where: {
        status: { [Op.in]: ['approved', 'in_progress', 'pending_approval'] },
        plannedDate: { [Op.lt]: today }
      },
      include: [{ model: User, as: 'technician', attributes: ['id', 'fullName', 'email'] }]
    });

    logger.info(`Found ${overdueOrders.length} overdue orders`);

    for (const order of overdueOrders) {
      const days = Math.floor((today - order.plannedDate) / (1000 * 60 * 60 * 24));

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
