import jwt from 'jsonwebtoken';
import { getOne } from '../db/database.js';

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return process.env.JWT_SECRET;
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
}

export async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const user = await getOne('SELECT id, role FROM users WHERE id = ?', [req.user.id]);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  req.user.role = 'admin';
  next();
}

export async function requireSeller(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const user = await getOne('SELECT id, role FROM users WHERE id = ?', [req.user.id]);
  if (!user || user.role !== 'seller') {
    return res.status(403).json({ message: 'Seller access required.' });
  }

  req.user.role = user.role;
  next();
}

export { getJwtSecret };
