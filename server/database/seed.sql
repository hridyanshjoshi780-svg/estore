PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO categories (id, name) VALUES
  (1, 'Electronics'),
  (2, 'Fashion'),
  (3, 'Home & Living');

INSERT OR IGNORE INTO users (id, name, email, password, role) VALUES
  (1, 'Admin User', 'admin@shopeasy.com', '$2b$10$BkiL5RTttf3hBYeSXiF3a.Pl8lkuTymlAyYnduKFA18Cat.8u5AEm', 'admin'),
  (2, 'Seller User', 'seller@shopeasy.com', '$2b$10$TnXjeK126aQbCWLWcOTP5eFmujfUxp7Q54mchc56lbiR4e0QMQIyS', 'seller');

INSERT OR IGNORE INTO products (id, category_id, seller_id, name, description, price, stock, image_url, is_active) VALUES
  (1, 1, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Wireless Earbuds', 'Comfortable wireless earbuds with deep bass and long battery life.', 2499, 18, '/images/products/01-wireless-earbuds.svg', 1),
  (2, 1, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Smart Watch Pro', 'Fitness tracking, heart rate monitor, and GPS support.', 5999, 12, '/images/products/02-smart-watch.svg', 1),
  (3, 1, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Bluetooth Speaker', 'Portable speaker with crystal-clear sound and waterproof design.', 3299, 15, '/images/products/03-bluetooth-speaker.svg', 1),
  (4, 1, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'USB-C Fast Charger', 'Compact wall charger with rapid smart charging for phones and tablets.', 1299, 24, '/images/products/04-usb-c-charger.svg', 1),
  (5, 1, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Laptop Stand', 'Aluminum stand for better posture and cooling during work.', 2199, 14, '/images/products/05-laptop-stand.svg', 1),
  (6, 2, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Classic White Tee', 'Breathable cotton basic tee for everyday comfort.', 799, 30, '/images/products/06-white-tee.svg', 1),
  (7, 2, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Denim Jacket', 'Lightweight jacket with classic casual styling.', 3499, 10, '/images/products/07-denim-jacket.svg', 1),
  (8, 2, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Cotton Joggers', 'Stretch-fit casual joggers with soft brushed interior.', 1899, 21, '/images/products/08-cotton-joggers.svg', 1),
  (9, 2, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Leather Wallet', 'Slim premium wallet with multiple compartments.', 1599, 16, '/images/products/09-leather-wallet.svg', 1),
  (10, 2, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Travel Backpack', 'Water-resistant backpack with laptop sleeve and side pockets.', 2899, 11, '/images/products/10-travel-backpack.svg', 1),
  (11, 3, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Ceramic Coffee Mug', 'Glossy mug for daily coffee rituals and comfort.', 699, 27, '/images/products/11-ceramic-mug.svg', 1),
  (12, 3, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Desk Lamp', 'Modern desk lamp with warm ambient lighting and USB port.', 1799, 13, '/images/products/12-desk-lamp.svg', 1),
  (13, 3, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Throw Blanket', 'Soft woven blanket ideal for living room and bedroom use.', 2199, 19, '/images/products/13-throw-blanket.svg', 1),
  (14, 3, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Storage Basket Set', 'Natural basket set to organize shelves and corners neatly.', 1499, 17, '/images/products/14-storage-basket.svg', 1),
  (15, 3, (SELECT id FROM users WHERE email = 'seller@shopeasy.com'), 'Air Freshener Diffuser', 'Elegant home diffuser with a long-lasting fragrance.', 1299, 20, '/images/products/15-air-diffuser.svg', 1);
