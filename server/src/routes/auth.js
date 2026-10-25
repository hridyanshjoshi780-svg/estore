import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getOne, runSQL } from '../db/database.js';
import { authenticateToken, getJwtSecret } from '../middleware/auth.js';

const router = express.Router();

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, getJwtSecret(), {
    expiresIn: '7d',
  });
}

router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email.trim() || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ message: 'Name must be 100 characters or fewer.' });
  }

  const normalizedRole = String(role || 'customer').trim().toLowerCase();
  if (!['customer', 'seller'].includes(normalizedRole)) {
    return res.status(400).json({ message: 'Role must be customer or seller.' });
  }

  const existingUser = await getOne('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existingUser) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await runSQL(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), normalizedEmail, passwordHash, normalizedRole],
    );

    const user = await getOne('SELECT id, name, email, role FROM users WHERE id = ?', [result.lastID]);
    const token = createToken(user);

    return res.status(201).json({ token, user });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    throw error;
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await getOne('SELECT id, name, email, password, role FROM users WHERE email = ?', [normalizedEmail]);

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = createToken(safeUser);

  return res.json({ token, user: safeUser });
});

router.get('/me', authenticateToken, async (req, res) => {
  const user = await getOne('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  return res.json({ user });
});

export default router;
