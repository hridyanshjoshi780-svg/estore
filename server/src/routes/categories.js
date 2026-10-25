import express from 'express';
import { getAll } from '../db/database.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const categories = await getAll('SELECT id, name FROM categories ORDER BY name ASC');
  return res.json(categories);
});

export default router;
