import express from 'express';
import { getAll, getOne, runSQL } from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  const rows = await getAll(`
    SELECT ci.id AS cart_item_id, ci.quantity, p.id AS product_id, p.name, p.price, p.stock, p.is_active, p.image_url,
           (ci.quantity * p.price) AS line_total
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.user_id = ?
    ORDER BY ci.created_at DESC
  `, [req.user.id]);

  const total = rows.reduce((sum, row) => sum + row.line_total, 0);
  return res.json({ items: rows, total });
});

router.post('/items', async (req, res) => {
  const { productId, quantity = 1 } = req.body || {};
  const numericQuantity = Number(quantity);

  if (!Number.isSafeInteger(Number(productId)) || Number(productId) < 1 || !Number.isSafeInteger(numericQuantity) || numericQuantity <= 0) {
    return res.status(400).json({ message: 'A valid product ID and quantity are required.' });
  }

  const product = await getOne('SELECT * FROM products WHERE id = ? AND is_active = 1', [Number(productId)]);
  if (!product) {
    return res.status(404).json({ message: 'Product not found or unavailable.' });
  }

  if (numericQuantity > product.stock) {
    return res.status(400).json({ message: 'Requested quantity exceeds available stock.' });
  }

  const existing = await getOne('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?', [req.user.id, Number(productId)]);
  if (existing) {
    const newQuantity = existing.quantity + numericQuantity;
    if (newQuantity > product.stock) {
      return res.status(400).json({ message: 'Cart quantity exceeds available stock.' });
    }

    await runSQL('UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newQuantity, existing.id]);
    const item = await getOne('SELECT * FROM cart_items WHERE id = ?', [existing.id]);
    return res.status(200).json({ message: 'Cart item updated.', item });
  }

  const result = await runSQL('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)', [req.user.id, Number(productId), numericQuantity]);
  const item = await getOne('SELECT * FROM cart_items WHERE id = ?', [result.lastID]);
  return res.status(201).json({ message: 'Item added to cart.', item });
});

router.patch('/items/:id', async (req, res) => {
  const itemId = Number(req.params.id);
  const nextQuantity = Number(req.body?.quantity);

  if (!Number.isSafeInteger(itemId) || itemId < 1 || !Number.isSafeInteger(nextQuantity) || nextQuantity <= 0) {
    return res.status(400).json({ message: 'Valid item ID and positive quantity are required.' });
  }

  const item = await getOne('SELECT ci.*, p.stock FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.id = ? AND ci.user_id = ?', [itemId, req.user.id]);
  if (!item) {
    return res.status(404).json({ message: 'Cart item not found.' });
  }

  if (nextQuantity > item.stock) {
    return res.status(400).json({ message: 'Quantity exceeds available stock.' });
  }

  await runSQL('UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextQuantity, itemId]);
  return res.json({ message: 'Cart item updated.' });
});

router.delete('/items/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).json({ message: 'Cart item not found.' });
  }
  const result = await runSQL('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'Cart item not found.' });
  }
  return res.json({ message: 'Cart item removed.' });
});

export default router;
