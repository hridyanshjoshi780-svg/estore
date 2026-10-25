import express from 'express';
import { getAll, getOne } from '../db/database.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { category, q } = req.query;
  const categoryId = category ? Number(category) : null;
  const searchTerm = q ? String(q).trim() : '';

  if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId < 1)) {
    return res.status(400).json({ message: 'Category must be a valid ID.' });
  }
  if (searchTerm.length > 200) {
    return res.status(400).json({ message: 'Search terms must be 200 characters or fewer.' });
  }

  let sql = `
    SELECT p.*, c.name AS category_name
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1
  `;
  const params = [];

  if (categoryId) {
    sql += ' AND p.category_id = ?';
    params.push(categoryId);
  }

  if (searchTerm) {
    sql += ' AND LOWER(p.name) LIKE ?';
    params.push(`%${searchTerm.toLowerCase()}%`);
  }

  sql += ' ORDER BY p.created_at DESC';

  const products = await getAll(sql, params);
  return res.json(products);
});

router.get('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).json({ message: 'Product not found.' });
  }
  const product = await getOne(
    `SELECT p.*, c.name AS category_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.id = ? AND p.is_active = 1`,
    [req.params.id],
  );

  if (!product) return res.status(404).json({ message: 'Product not found.' });
  return res.json(product);
});

export default router;
