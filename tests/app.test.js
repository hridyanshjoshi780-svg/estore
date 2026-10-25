import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const testDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'shopeasy-test-'));
process.env.SHOP_EASY_DB_PATH = path.join(testDirectory, 'shopeasy-test.db');
process.env.JWT_SECRET ||= 'test-only-jwt-secret';

const [{ startServer }, { closeDatabase, execSQL, getAll, getOne }] = await Promise.all([
  import('../server/src/app.js'),
  import('../server/src/db/database.js'),
]);

let server;
let baseUrl;

async function request(endpoint, { token, ...options } = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return { response, payload };
}

async function registerAccount(role = 'customer') {
  const email = `test-${randomUUID()}@example.test`;
  const { response, payload } = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'ShopEasy Test', email, password: 'secret123', role }),
  });
  assert.equal(response.status, 201);
  return payload;
}

async function login(email, password) {
  const { response, payload } = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return payload;
}

test.before(async () => {
  await execSQL(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE users_legacy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL CHECK (price >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    );
    CREATE TABLE cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users_legacy(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE TABLE orders (
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
      FOREIGN KEY (user_id) REFERENCES users_legacy(id) ON DELETE RESTRICT
    );
    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      line_total INTEGER NOT NULL CHECK (line_total >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );

    INSERT INTO users (id, name, email, password, role) VALUES (42, 'Legacy Customer', 'legacy@example.test', 'legacy-hash', 'customer');
    INSERT INTO users_legacy (id, name, email, password, role) VALUES (42, 'Legacy Customer', 'legacy@example.test', 'legacy-hash', 'customer');
    INSERT INTO categories (id, name) VALUES (9, 'Legacy Category');
    INSERT INTO products (id, category_id, name, description, price, stock) VALUES (99, 9, 'Legacy Product', 'Existing data must remain', 500, 5);
    INSERT INTO cart_items (id, user_id, product_id, quantity) VALUES (77, 42, 99, 2);
    INSERT INTO orders (id, user_id, customer_name, phone, address, city, pin_code, total) VALUES (88, 42, 'Legacy Customer', '9876543210', '12 Test Road', 'Pune', '411001', 500);
    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, line_total) VALUES (55, 88, 99, 'Legacy Product', 1, 500, 500);
  `);

  const app = await startServer();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  await closeDatabase();
  await fs.rm(testDirectory, { recursive: true, force: true });
});

test('health, static pages, and seeded catalogue are served', async () => {
  const health = await request('/api/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.payload.status, 'ok');

  const storefront = await fetch(baseUrl);
  assert.equal(storefront.status, 200);
  assert.match(await storefront.text(), /ShopEasy/);
  for (const page of ['/seller/dashboard.html', '/seller/products.html', '/seller/orders.html', '/admin/products.html']) {
    assert.equal((await fetch(`${baseUrl}${page}`)).status, 200);
  }

  const products = await request('/api/products');
  assert.equal(products.response.status, 200);
  assert.ok(products.payload.length >= 16);
  const seededProducts = products.payload.filter((product) => product.id >= 1 && product.id <= 15);
  assert.equal(seededProducts.length, 15);
  assert.ok(seededProducts.every((product) => product.image_url.startsWith('/images/products/')));
  for (const product of seededProducts) {
    const image = await fetch(`${baseUrl}${product.image_url}`);
    assert.equal(image.status, 200, `${product.name} image should be served`);
    assert.match(image.headers.get('content-type'), /image\/svg\+xml/);
  }
  assert.equal((await request('/api/products?q=wireless')).payload.length, 1);
  assert.ok((await request('/api/categories')).payload.some((category) => category.name === 'Electronics'));
});

test('database migration preserves existing customer, cart, order, and product data', async () => {
  const legacyUser = await getOne('SELECT id, role FROM users WHERE email = ?', ['legacy@example.test']);
  assert.deepEqual(legacyUser, { id: 42, role: 'customer' });
  assert.deepEqual(await getOne('SELECT quantity FROM cart_items WHERE id = ?', [77]), { quantity: 2 });
  assert.deepEqual(await getOne('SELECT total FROM orders WHERE id = ?', [88]), { total: 500 });
  assert.deepEqual(await getOne('SELECT stock, seller_id FROM products WHERE id = ?', [99]), { stock: 5, seller_id: null });
  assert.equal(await getOne("SELECT name FROM sqlite_master WHERE name = 'users_legacy'", []), undefined);
  assert.deepEqual(await getAll('PRAGMA foreign_key_check'), []);
});

test('customer, seller, and admin flows enforce roles and preserve transactional prices', async () => {
  const customer = await registerAccount();
  const seller = await registerAccount('seller');
  const secondSeller = await registerAccount('seller');
  const demoSeller = await login('seller@shopeasy.com', 'seller123');
  const admin = await login('admin@shopeasy.com', 'admin123');

  assert.equal((await request('/api/admin/stats')).response.status, 401);
  assert.equal((await request('/api/seller/products', { token: customer.token })).response.status, 403);
  assert.equal((await request('/api/admin/stats', { token: customer.token })).response.status, 403);
  assert.ok((await request('/api/seller/products', { token: demoSeller.token })).payload.length >= 15);

  const categories = await request('/api/categories');
  const categoryId = categories.payload.find((category) => category.name === 'Electronics').id;
  const createdProduct = await request('/api/seller/products', {
    token: seller.token,
    method: 'POST',
    body: JSON.stringify({
      categoryId,
      name: 'Seller Test Item',
      description: 'Seller item',
      price: 1200,
      stock: 3,
      imageUrl: '/images/products/01-wireless-earbuds.svg',
    }),
  });
  assert.equal(createdProduct.response.status, 201);
  assert.equal(createdProduct.payload.image_url, '/images/products/01-wireless-earbuds.svg');
  const productId = createdProduct.payload.id;
  const unsafeImage = await request('/api/seller/products', {
    token: seller.token,
    method: 'POST',
    body: JSON.stringify({ categoryId, name: 'Unsafe image path', price: 1, stock: 1, imageUrl: '/etc/passwd' }),
  });
  assert.equal(unsafeImage.response.status, 400);

  assert.equal((await request(`/api/seller/products/${productId}`, {
    token: secondSeller.token,
    method: 'PUT',
    body: JSON.stringify({ categoryId, name: 'Not yours', description: '', price: 1, stock: 1 }),
  })).response.status, 404);
  assert.ok((await request(`/api/products?q=${encodeURIComponent('Seller Test Item')}`)).payload.some((product) => product.id === productId));

  const cartAdd = await request('/api/cart/items', {
    token: customer.token,
    method: 'POST',
    body: JSON.stringify({ productId, quantity: 2 }),
  });
  assert.equal(cartAdd.response.status, 201);

  const stockChanged = await request(`/api/seller/products/${productId}`, {
    token: seller.token,
    method: 'PUT',
    body: JSON.stringify({ categoryId, name: 'Seller Test Item', description: 'Seller item', price: 1300, stock: 1 }),
  });
  assert.equal(stockChanged.response.status, 200);
  assert.equal(stockChanged.payload.image_url, '/images/products/01-wireless-earbuds.svg');

  const checkoutPayload = {
    customerName: 'ShopEasy Test',
    phone: '9876543210',
    address: '42 Test Street',
    city: 'Pune',
    pinCode: '411001',
  };
  const failedCheckout = await request('/api/orders', {
    token: customer.token,
    method: 'POST',
    body: JSON.stringify(checkoutPayload),
  });
  assert.equal(failedCheckout.response.status, 409, JSON.stringify(failedCheckout.payload));
  assert.equal((await request('/api/cart', { token: customer.token })).payload.items[0].quantity, 2);

  await request(`/api/seller/products/${productId}`, {
    token: seller.token,
    method: 'PUT',
    body: JSON.stringify({ categoryId, name: 'Seller Test Item', description: 'Updated description', price: 1450, stock: 3 }),
  });
  const checkout = await request('/api/orders', {
    token: customer.token,
    method: 'POST',
    body: JSON.stringify(checkoutPayload),
  });
  assert.equal(checkout.response.status, 201);
  assert.equal(checkout.payload.total, 2900);
  assert.equal((await request('/api/cart', { token: customer.token })).payload.items.length, 0);

  const orderDetail = await request(`/api/orders/${checkout.payload.order.id}`, { token: customer.token });
  assert.equal(orderDetail.response.status, 200);
  assert.equal(orderDetail.payload.items[0].unit_price, 1450);
  assert.equal((await request(`/api/orders/${checkout.payload.order.id}`, { token: secondSeller.token })).response.status, 403);

  const sellerOrders = await request('/api/seller/orders', { token: seller.token });
  assert.equal(sellerOrders.payload[0].seller_total, 2900);
  const sellerOrderDetail = await request(`/api/seller/orders/${checkout.payload.order.id}`, { token: seller.token });
  assert.equal(sellerOrderDetail.response.status, 200);
  assert.equal(sellerOrderDetail.payload.items.length, 1);
  assert.equal('address' in sellerOrderDetail.payload.order, false);

  await request('/api/cart/items', {
    token: customer.token,
    method: 'POST',
    body: JSON.stringify({ productId, quantity: 1 }),
  });
  const duplicateCheckout = await Promise.all([
    request('/api/orders', { token: customer.token, method: 'POST', body: JSON.stringify(checkoutPayload) }),
    request('/api/orders', { token: customer.token, method: 'POST', body: JSON.stringify(checkoutPayload) }),
  ]);
  assert.deepEqual(duplicateCheckout.map((result) => result.response.status).sort(), [201, 400]);
  assert.equal((await request('/api/products/' + productId)).payload.stock, 0);
  assert.equal((await request('/api/cart', { token: customer.token })).payload.items.length, 0);

  const adminStats = await request('/api/admin/stats', { token: admin.token });
  assert.equal(adminStats.response.status, 200);
  const adminCategory = await request('/api/admin/categories', {
    token: admin.token,
    method: 'POST',
    body: JSON.stringify({ name: 'Test Category' }),
  });
  assert.equal(adminCategory.response.status, 201);
  const adminProduct = await request('/api/admin/products', {
    token: admin.token,
    method: 'POST',
    body: JSON.stringify({
      categoryId: adminCategory.payload.id,
      name: 'Admin Managed Item',
      price: 800,
      stock: 4,
      imageUrl: '/images/products/02-smart-watch.svg',
    }),
  });
  assert.equal(adminProduct.response.status, 201);
  assert.equal(adminProduct.payload.image_url, '/images/products/02-smart-watch.svg');
  const adminProducts = await request('/api/admin/products', { token: admin.token });
  assert.ok(adminProducts.payload.some((product) => product.id === adminProduct.payload.id));
  const updatedAdminProduct = await request(`/api/admin/products/${adminProduct.payload.id}`, {
    token: admin.token,
    method: 'PUT',
    body: JSON.stringify({ categoryId: adminCategory.payload.id, name: 'Updated Admin Item', price: 900, stock: 3 }),
  });
  assert.equal(updatedAdminProduct.payload.name, 'Updated Admin Item');
  assert.equal((await request(`/api/admin/products/${adminProduct.payload.id}`, {
    token: admin.token,
    method: 'DELETE',
  })).response.status, 200);
  assert.equal((await request(`/api/admin/categories/${adminCategory.payload.id}`, {
    token: admin.token,
    method: 'DELETE',
  })).response.status, 409);

  const statusUpdate = await request(`/api/orders/admin/${checkout.payload.order.id}/status`, {
    token: admin.token,
    method: 'PATCH',
    body: JSON.stringify({ status: 'Shipped' }),
  });
  assert.equal(statusUpdate.response.status, 200);
  assert.equal((await request(`/api/orders/admin/${checkout.payload.order.id}/status`, {
    token: admin.token,
    method: 'PATCH',
    body: JSON.stringify({ status: 'Placed' }),
  })).response.status, 409);
});
