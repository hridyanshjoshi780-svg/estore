import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import sellerRoutes from './routes/seller.js';
import { initializeDatabase } from './db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const publicPath = path.resolve(__dirname, '../../public');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/seller', sellerRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'ShopEasy API' });
});

app.use(express.static(publicPath, { index: 'index.html' }));
app.use('/api', (req, res) => res.status(404).json({ message: 'API endpoint not found.' }));
app.use((req, res) => res.status(404).send('Page not found.'));

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status = err.type === 'entity.parse.failed'
    ? 400
    : Number.isInteger(err.status) && err.status >= 400 && err.status < 500
      ? err.status
      : 500;
  if (status === 500) console.error('Request failed:', err.message);
  const message = status === 400 && err.type === 'entity.parse.failed'
    ? 'Invalid JSON request body.'
    : status < 500
      ? err.message
      : 'Internal server error.';
  res.status(status).json({ message });
});

export async function startServer() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Copy server/.env.example to server/.env and configure it.');
  }
  await initializeDatabase();
  return app;
}

export default app;
