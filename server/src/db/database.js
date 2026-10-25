import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { AsyncLocalStorage } from 'node:async_hooks';
import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.SHOP_EASY_DB_PATH || path.join(__dirname, '../../../data', 'shopeasy.db');

sqlite3.verbose();
await fs.mkdir(path.dirname(dbPath), { recursive: true });
const transactionContext = new AsyncLocalStorage();
let transactionQueue = Promise.resolve();

let db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open SQLite database:', err.message);
    process.exit(1);
  }
});

export { db };

export const runSQL = async (sql, params = []) => {
  if (!transactionContext.getStore()) await transactionQueue;
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const execSQL = async (sql) => {
  if (!transactionContext.getStore()) await transactionQueue;
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => (error ? reject(error) : resolve()));
  });
};

export const getOne = async (sql, params = []) => {
  if (!transactionContext.getStore()) await transactionQueue;
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const getAll = async (sql, params = []) => {
  if (!transactionContext.getStore()) await transactionQueue;
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export async function withTransaction(callback) {
  let release;
  const previousTransaction = transactionQueue;
  transactionQueue = new Promise((resolve) => {
    release = resolve;
  });
  await previousTransaction;

  try {
    return await transactionContext.run(true, async () => {
      await execSQL('BEGIN IMMEDIATE');
      try {
        const result = await callback();
        await execSQL('COMMIT');
        return result;
      } catch (error) {
        try {
          await execSQL('ROLLBACK');
        } catch (rollbackError) {
          console.error('Database transaction rollback failed:', rollbackError.message);
        }
        throw error;
      }
    });
  } finally {
    release();
  }
}

export function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((error) => (error ? reject(error) : resolve()));
  });
}

export async function initializeDatabase() {
  const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
  const seedPath = path.resolve(__dirname, '../../database/seed.sql');

  await execSQL('PRAGMA foreign_keys = ON;');

  const schemaSql = await fs.readFile(schemaPath, 'utf8');
  const seedSql = await fs.readFile(seedPath, 'utf8');

  await execSQL(schemaSql);

  await execSQL('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;');
  try {
    const legacyUsers = await getOne("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users_legacy'");
    if (legacyUsers) {
      for (const table of ['cart_items', 'orders']) {
        const tableExists = await getOne("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [table]);
        if (!tableExists) continue;

        const references = await getAll(`PRAGMA foreign_key_list(${table})`);
        if (!references.some((reference) => reference.table === 'users_legacy')) continue;

        if (table === 'cart_items') {
          await execSQL(`
            CREATE TABLE cart_items_migration (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              product_id INTEGER NOT NULL,
              quantity INTEGER NOT NULL CHECK (quantity > 0),
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, product_id),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            );
            INSERT INTO cart_items_migration (id, user_id, product_id, quantity, created_at, updated_at)
              SELECT id, user_id, product_id, quantity, created_at, updated_at FROM cart_items;
            DROP TABLE cart_items;
            ALTER TABLE cart_items_migration RENAME TO cart_items;
          `);
        } else {
          await execSQL(`
            CREATE TABLE orders_migration (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              customer_name TEXT NOT NULL,
              phone TEXT NOT NULL,
              address TEXT NOT NULL,
              city TEXT NOT NULL,
              pin_code TEXT NOT NULL,
              payment_method TEXT NOT NULL DEFAULT 'COD',
              status TEXT NOT NULL DEFAULT 'Placed' CHECK (status IN ('Placed', 'Shipped', 'Delivered')),
              total INTEGER NOT NULL CHECK (total >= 0),
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
            );
            INSERT INTO orders_migration (id, user_id, customer_name, phone, address, city, pin_code, payment_method, status, total, created_at, updated_at)
              SELECT id, user_id, customer_name, phone, address, city, pin_code, payment_method, status, total, created_at, updated_at FROM orders;
            DROP TABLE orders;
            ALTER TABLE orders_migration RENAME TO orders;
          `);
        }
      }
    }

    const userSchema = await getOne("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'");
    const userColumns = await getAll('PRAGMA table_info(users)');
    const supportsSellerRole = userSchema?.sql?.includes("'seller'");
    if (!supportsSellerRole) {
      const roleExpression = userColumns.some((column) => column.name === 'role')
        ? "CASE WHEN role IN ('customer', 'seller', 'admin') THEN role ELSE 'customer' END"
        : "'customer'";
      const createdAtExpression = userColumns.some((column) => column.name === 'created_at') ? 'created_at' : 'CURRENT_TIMESTAMP';
      const updatedAtExpression = userColumns.some((column) => column.name === 'updated_at') ? 'updated_at' : 'CURRENT_TIMESTAMP';

      await execSQL(`
        CREATE TABLE users_migration (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'seller', 'admin')),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users_migration (id, name, email, password, role, created_at, updated_at)
          SELECT id, name, email, password, ${roleExpression}, ${createdAtExpression}, ${updatedAtExpression} FROM users;
        DROP TABLE users;
        ALTER TABLE users_migration RENAME TO users;
      `);
    }

    if (legacyUsers) {
      const legacyColumns = await getAll('PRAGMA table_info(users_legacy)');
      const roleExpression = legacyColumns.some((column) => column.name === 'role')
        ? "CASE WHEN role IN ('customer', 'seller', 'admin') THEN role ELSE 'customer' END"
        : "'customer'";
      const createdAtExpression = legacyColumns.some((column) => column.name === 'created_at') ? 'created_at' : 'CURRENT_TIMESTAMP';
      const updatedAtExpression = legacyColumns.some((column) => column.name === 'updated_at') ? 'updated_at' : 'CURRENT_TIMESTAMP';
      await execSQL(`
        INSERT OR IGNORE INTO users (id, name, email, password, role, created_at, updated_at)
          SELECT id, name, email, password, ${roleExpression}, ${createdAtExpression}, ${updatedAtExpression} FROM users_legacy;
        DROP TABLE users_legacy;
      `);
    }

    const productColumns = await getAll('PRAGMA table_info(products)');
    if (!productColumns.some((column) => column.name === 'seller_id')) {
      await execSQL('ALTER TABLE products ADD COLUMN seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    }
    if (!productColumns.some((column) => column.name === 'image_url')) {
      await execSQL('ALTER TABLE products ADD COLUMN image_url TEXT');
    }

    await execSQL('COMMIT; PRAGMA foreign_keys = ON;');
  } catch (error) {
    await execSQL('ROLLBACK; PRAGMA foreign_keys = ON;');
    throw error;
  }

  const sellerUser = await getOne('SELECT id, password FROM users WHERE email = ?', ['seller@shopeasy.com']);
  if (!sellerUser) {
    const sellerPasswordHash = await bcrypt.hash('seller123', 10);
    await runSQL(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Seller User', 'seller@shopeasy.com', sellerPasswordHash, 'seller'],
    );
  }

  const adminUser = await getOne('SELECT id, password FROM users WHERE email = ?', ['admin@shopeasy.com']);
  if (!adminUser) {
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    await runSQL(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Admin User', 'admin@shopeasy.com', adminPasswordHash, 'admin'],
    );
  }

  await execSQL(seedSql);

  const seededSeller = await getOne('SELECT id FROM users WHERE email = ?', ['seller@shopeasy.com']);
  if (seededSeller) {
    const sampleProducts = [
      [1, 'Wireless Earbuds', '/images/products/01-wireless-earbuds.svg'],
      [2, 'Smart Watch Pro', '/images/products/02-smart-watch.svg'],
      [3, 'Bluetooth Speaker', '/images/products/03-bluetooth-speaker.svg'],
      [4, 'USB-C Fast Charger', '/images/products/04-usb-c-charger.svg'],
      [5, 'Laptop Stand', '/images/products/05-laptop-stand.svg'],
      [6, 'Classic White Tee', '/images/products/06-white-tee.svg'],
      [7, 'Denim Jacket', '/images/products/07-denim-jacket.svg'],
      [8, 'Cotton Joggers', '/images/products/08-cotton-joggers.svg'],
      [9, 'Leather Wallet', '/images/products/09-leather-wallet.svg'],
      [10, 'Travel Backpack', '/images/products/10-travel-backpack.svg'],
      [11, 'Ceramic Coffee Mug', '/images/products/11-ceramic-mug.svg'],
      [12, 'Desk Lamp', '/images/products/12-desk-lamp.svg'],
      [13, 'Throw Blanket', '/images/products/13-throw-blanket.svg'],
      [14, 'Storage Basket Set', '/images/products/14-storage-basket.svg'],
      [15, 'Air Freshener Diffuser', '/images/products/15-air-diffuser.svg'],
    ];
    const expectedProducts = sampleProducts.map(() => '(id = ? AND name = ?)').join(' OR ');
    await runSQL(
      `UPDATE products SET seller_id = ? WHERE (${expectedProducts})`,
      [seededSeller.id, ...sampleProducts.flatMap(([id, name]) => [id, name])],
    );
    for (const [id, name, imagePath] of sampleProducts) {
      await runSQL(
        `UPDATE products SET image_url = ?
         WHERE id = ? AND name = ? AND (image_url IS NULL OR TRIM(image_url) = '')`,
        [imagePath, id, name],
      );
    }
  }
}
