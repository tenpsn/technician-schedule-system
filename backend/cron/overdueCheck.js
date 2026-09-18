const cron = require('node-cron');
const { Op } = require('sequelize');
const WorkOrder = require('../models/WorkOrder');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../config/logger');
const { computeOverdue } = require('../utils/overdueCalc');

// รันทุก 30 นาที ให้ตรงกับตัวเลือกเวลาในฟอร์มเว็บที่มีช่วงห่างกัน 30 นาทีเท่ากัน ดู time picker component.ts
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

    const overdueOrders = candidates.filter((order) => computeOverdue(order, now).isOverdue);

    logger.info(`Found ${overdueOrders.length} overdue orders`);

    for (const order of overdueOrders) {
      // ถ้าบันทึกหรือแจ้งเตือนงานหนึ่งพัง ไม่ควรทำให้ทั้งชุดหยุดไปด้วย
      // ไม่งั้นงานที่มีปัญหาชิ้นเดียวจะบล็อกงานอื่นที่ควรประมวลผลต่อทุกรอบจนกว่าจะแก้
      try {
        const { overdueDays: days } = computeOverdue(order, now);

        // อัปเดตเฉพาะตอนยังไม่ถูกตีว่าเลยกำหนด หรือจำนวนวันเพิ่มขึ้น
        if (!order.isOverdue || order.overdueDays !== days) {
          order.isOverdue = true;
          order.overdueDays = days;
          order.status = 'overdue';
          await order.save();

          logger.info(`Order ${order.srNumber} marked as overdue (${days} days)`);

          // แจ้งเตือนช่าง
          await Notification.create({
            recipientId: order.technicianId,
            type: 'overdue',
            title: '⚠️ งานค้างเกินกำหนด',
            message: `งาน ${order.srNumber} (${order.customerName}) ค้าง ${days} วัน กรุณาอัปเดตสถานะหรือเลื่อนงาน`,
            relatedWorkOrderId: order.id
          });

          // แจ้งเตือนหัวหน้างานทุกคน
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
