import express from 'express';
import { getAll, getOne, runSQL } from '../db/database.js';
import { authenticateToken, requireSeller } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken, requireSeller);

function validateProduct(payload, existing = {}) {
  const categoryId = Number(payload.categoryId ?? existing.category_id);
  const name = String(payload.name ?? existing.name ?? '').trim();
  const description = String(payload.description ?? existing.description ?? '').trim();
  const price = Number(payload.price ?? existing.price);
  const stock = Number(payload.stock ?? existing.stock);
  const imageUrl = String(payload.imageUrl ?? existing.image_url ?? '').trim();

  if (!Number.isInteger(categoryId) || categoryId < 1) return { error: 'Select a valid category.' };
  if (!name || name.length > 120) return { error: 'Product name is required and must be 120 characters or fewer.' };
  if (description.length > 2000) return { error: 'Description must be 2000 characters or fewer.' };
  if (!Number.isSafeInteger(price) || price < 0) return { error: 'Price must be a non-negative whole number of rupees.' };
  if (!Number.isSafeInteger(stock) || stock < 0) return { error: 'Stock must be a non-negative whole number.' };
  if (imageUrl.length > 500 || (imageUrl && !(/^https?:\/\/\S+$/i.test(imageUrl) || /^\/images\/products\/[a-z0-9-]+\.svg$/i.test(imageUrl)))) {
    return { error: 'Use an HTTP(S) image URL or a local /images/products/*.svg asset path (500 characters or fewer).' };
  }

  return { value: { categoryId, name, description, price, stock, imageUrl } };
}

router.get('/stats', async (req, res) => {
  const [products, orders] = await Promise.all([
    getOne(
      'SELECT COUNT(*) AS total_products, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_products FROM products WHERE seller_id = ?',
      [req.user.id],
    ),
    getOne(
      `SELECT COUNT(DISTINCT o.id) AS total_orders
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE p.seller_id = ?`,
      [req.user.id],
    ),
  ]);
  return res.json({ products, orders });
});

router.get('/products', async (req, res) => {
  const products = await getAll(
    `SELECT p.*, c.name AS category_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.seller_id = ?
     ORDER BY p.created_at DESC`,
    [req.user.id],
  );
  return res.json(products);
});

router.post('/products', async (req, res) => {
  const validation = validateProduct(req.body || {});
  if (validation.error) return res.status(400).json({ message: validation.error });

  const category = await getOne('SELECT id FROM categories WHERE id = ?', [validation.value.categoryId]);
  if (!category) return res.status(400).json({ message: 'Invalid category reference.' });

  const { categoryId, name, description, price, stock, imageUrl } = validation.value;
  const result = await runSQL(
    `INSERT INTO products (category_id, seller_id, name, description, price, stock, image_url, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [categoryId, req.user.id, name, description, price, stock, imageUrl],
  );
  const product = await getOne(
    'SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?',
    [result.lastID],
  );
  return res.status(201).json(product);
});

router.put('/products/:id', async (req, res) => {
  const product = await getOne('SELECT * FROM products WHERE id = ? AND seller_id = ?', [req.params.id, req.user.id]);
  if (!product) return res.status(404).json({ message: 'Product not found for this seller.' });

  const validation = validateProduct(req.body || {}, product);
  if (validation.error) return res.status(400).json({ message: validation.error });

  const category = await getOne('SELECT id FROM categories WHERE id = ?', [validation.value.categoryId]);
  if (!category) return res.status(400).json({ message: 'Invalid category reference.' });

  const isActive = typeof req.body?.isActive === 'boolean' ? Number(req.body.isActive) : product.is_active;
  const { categoryId, name, description, price, stock, imageUrl } = validation.value;
  await runSQL(
    `UPDATE products
     SET category_id = ?, name = ?, description = ?, price = ?, stock = ?, image_url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND seller_id = ?`,
    [categoryId, name, description, price, stock, imageUrl, isActive, req.params.id, req.user.id],
  );
  const updatedProduct = await getOne(
    'SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?',
    [req.params.id],
  );
  return res.json(updatedProduct);
});

router.delete('/products/:id', async (req, res) => {
  const result = await runSQL(
    'UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND seller_id = ?',
    [req.params.id, req.user.id],
  );
  if (result.changes === 0) return res.status(404).json({ message: 'Product not found for this seller.' });
  return res.json({ message: 'Product deactivated.' });
});

router.get('/orders', async (req, res) => {
  const orders = await getAll(
    `SELECT o.id, o.status, o.created_at, SUM(oi.line_total) AS seller_total, COUNT(oi.id) AS item_count
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     WHERE p.seller_id = ?
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [req.user.id],
  );
  return res.json(orders);
});

router.get('/orders/:id', async (req, res) => {
  const order = await getOne(
    `SELECT o.id, o.status, o.created_at, SUM(oi.line_total) AS seller_total
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     WHERE o.id = ? AND p.seller_id = ?
     GROUP BY o.id`,
    [req.params.id, req.user.id],
  );
  if (!order) return res.status(404).json({ message: 'Order not found for this seller.' });

  const items = await getAll(
    `SELECT oi.product_name, oi.quantity, oi.unit_price, oi.line_total
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ? AND p.seller_id = ?`,
    [req.params.id, req.user.id],
  );
  return res.json({ order, items });
});

export default router;
