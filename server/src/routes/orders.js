import express from 'express';
import { getAll, getOne, runSQL } from '../db/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { createOrderForUser } from '../services/checkout.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  const rows = await getAll(
    `SELECT o.*, SUM(oi.line_total) AS computed_total
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = ?
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [req.user.id],
  );
  return res.json(rows);
});

router.get('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ message: 'Order not found.' });
  const order = await getOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  const currentUser = await getOne('SELECT role FROM users WHERE id = ?', [req.user.id]);
  if (!currentUser || (currentUser.role !== 'admin' && order.user_id !== req.user.id)) {
    return res.status(403).json({ message: 'You are not allowed to view this order.' });
  }

  const items = await getAll('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  return res.json({ order, items });
});

router.post('/', async (req, res) => {
  const payload = req.body || {};

  const { orderId, total } = await createOrderForUser(req.user.id, {
    customerName: payload.customerName,
    phone: payload.phone,
    address: payload.address,
    city: payload.city,
    pinCode: payload.pinCode,
  });
  const order = await getOne('SELECT * FROM orders WHERE id = ?', [orderId]);
  return res.status(201).json({ message: 'Order placed successfully.', total, order });
});

router.patch('/admin/:id/status', requireAdmin, async (req, res) => {
  const status = String(req.body?.status || '').trim();
  const validStatuses = ['Placed', 'Shipped', 'Delivered'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Order status must be Placed, Shipped, or Delivered.' });
  }

  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ message: 'Order not found.' });
  const currentOrder = await getOne('SELECT status FROM orders WHERE id = ?', [req.params.id]);
  if (!currentOrder) {
    return res.status(404).json({ message: 'Order not found.' });
  }
  const nextStatus = { Placed: 'Shipped', Shipped: 'Delivered', Delivered: 'Delivered' }[currentOrder.status];
  if (status !== currentOrder.status && status !== nextStatus) {
    return res.status(409).json({ message: `Order status can move from ${currentOrder.status} to ${nextStatus} only.` });
  }

  await runSQL('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);
  const order = await getOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  return res.json({ message: 'Order status updated.', order });
});

export default router;
