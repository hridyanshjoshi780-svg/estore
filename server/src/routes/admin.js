import express from 'express';
import { getAll, getOne, runSQL } from '../db/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken, requireAdmin);

function validateProduct(payload) {
  const categoryId = Number(payload.categoryId);
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  const price = Number(payload.price);
  const stock = Number(payload.stock ?? 0);
  const imageUrl = typeof payload.imageUrl === 'string' ? payload.imageUrl.trim() : '';

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

function validateCategoryName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
    return { error: 'Category name is required and must be 80 characters or fewer.' };
  }
  return { value: name.trim() };
}

router.get('/stats', async (req, res) => {
  const [orders, products, users] = await Promise.all([
    getOne('SELECT COUNT(*) AS total_orders, COALESCE(SUM(total), 0) AS total_revenue FROM orders'),
    getOne('SELECT COUNT(*) AS total_products, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_products FROM products'),
    getOne('SELECT COUNT(*) AS total_users FROM users'),
  ]);
  return res.json({ orders, products, users });
});

router.get('/orders', async (req, res) => {
  const orders = await getAll(`
    SELECT o.*, u.name AS customer_name, u.email
    FROM orders o
    JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
  `);
  return res.json(orders);
});

router.get('/products', async (req, res) => {
  const products = await getAll(
    `SELECT p.*, c.name AS category_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ORDER BY p.created_at DESC`,
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
    `INSERT INTO products (category_id, name, description, price, stock, image_url, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [categoryId, name, description, price, stock, imageUrl],
  );
  const product = await getOne('SELECT * FROM products WHERE id = ?', [result.lastID]);
  return res.status(201).json(product);
});

router.put('/products/:id', async (req, res) => {
  const validation = validateProduct(req.body || {});
  if (validation.error) return res.status(400).json({ message: validation.error });

  const category = await getOne('SELECT id FROM categories WHERE id = ?', [validation.value.categoryId]);
  if (!category) return res.status(400).json({ message: 'Invalid category reference.' });

  const { categoryId, name, description, price, stock, imageUrl } = validation.value;
  const result = await runSQL(
    `UPDATE products
     SET category_id = ?, name = ?, description = ?, price = ?, stock = ?, image_url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [categoryId, name, description, price, stock, imageUrl, req.body.isActive === false ? 0 : 1, req.params.id],
  );
  if (result.changes === 0) return res.status(404).json({ message: 'Product not found.' });
  const product = await getOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
  return res.json(product);
});

router.delete('/products/:id', async (req, res) => {
  const result = await runSQL('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
  if (result.changes === 0) return res.status(404).json({ message: 'Product not found.' });
  return res.json({ message: 'Product deactivated.' });
});

router.get('/categories', async (req, res) => {
  const categories = await getAll('SELECT * FROM categories ORDER BY name ASC');
  return res.json(categories);
});

router.post('/categories', async (req, res) => {
  const validation = validateCategoryName(req.body?.name);
  if (validation.error) return res.status(400).json({ message: validation.error });

  const existing = await getOne('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [validation.value]);
  if (existing) return res.status(409).json({ message: 'Category already exists.' });

  const result = await runSQL('INSERT INTO categories (name) VALUES (?)', [validation.value]);
  const category = await getOne('SELECT * FROM categories WHERE id = ?', [result.lastID]);
  return res.status(201).json(category);
});

router.put('/categories/:id', async (req, res) => {
  const validation = validateCategoryName(req.body?.name);
  if (validation.error) return res.status(400).json({ message: validation.error });

  const existing = await getOne('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?', [validation.value, req.params.id]);
  if (existing) return res.status(409).json({ message: 'Category already exists.' });

  const result = await runSQL('UPDATE categories SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [validation.value, req.params.id]);
  if (result.changes === 0) return res.status(404).json({ message: 'Category not found.' });
  const category = await getOne('SELECT * FROM categories WHERE id = ?', [req.params.id]);
  return res.json(category);
});

router.delete('/categories/:id', async (req, res) => {
  const products = await getOne('SELECT COUNT(*) AS count FROM products WHERE category_id = ?', [req.params.id]);
  if (products.count > 0) {
    return res.status(409).json({ message: 'Cannot delete a category that has products assigned to it.' });
  }

  const result = await runSQL('DELETE FROM categories WHERE id = ?', [req.params.id]);
  if (result.changes === 0) return res.status(404).json({ message: 'Category not found.' });
  return res.json({ message: 'Category deleted.' });
});

export default router;
