import { getAll, runSQL, withTransaction } from '../db/database.js';

export async function createOrderForUser(userId, orderData) {
  const customerName = typeof orderData.customerName === 'string' ? orderData.customerName.trim() : '';
  const phone = typeof orderData.phone === 'string' ? orderData.phone.trim() : '';
  const address = typeof orderData.address === 'string' ? orderData.address.trim() : '';
  const city = typeof orderData.city === 'string' ? orderData.city.trim() : '';
  const pinCode = typeof orderData.pinCode === 'string' ? orderData.pinCode.trim() : '';

  if (!customerName || customerName.length > 100) {
    throw Object.assign(new Error('Enter a name of 1 to 100 characters.'), { status: 400 });
  }
  if (!/^\+?[0-9][0-9\s-]{8,14}$/.test(phone)) {
    throw Object.assign(new Error('Enter a valid phone number.'), { status: 400 });
  }
  if (address.length < 5 || address.length > 300 || !city || city.length > 100) {
    throw Object.assign(new Error('Enter a valid address and city.'), { status: 400 });
  }
  if (!/^\d{6}$/.test(pinCode)) {
    throw Object.assign(new Error('PIN code must contain six digits.'), { status: 400 });
  }

  return withTransaction(async () => {
    const cartItems = await getAll(
      `SELECT ci.id AS cart_item_id, ci.quantity, p.id AS product_id, p.name AS product_name, p.price, p.stock, p.is_active
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ?`,
      [userId],
    );

    if (!cartItems.length) {
      throw Object.assign(new Error('Your cart is empty.'), { status: 400 });
    }

    const invalidItem = cartItems.find((item) => item.quantity > item.stock || item.quantity <= 0 || item.is_active !== 1);
    if (invalidItem) {
      throw Object.assign(new Error(`Product "${invalidItem.product_name}" is unavailable or no longer has enough stock.`), { status: 409 });
    }

    const total = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const orderResult = await runSQL(
      `INSERT INTO orders (user_id, customer_name, phone, address, city, pin_code, payment_method, status, total)
       VALUES (?, ?, ?, ?, ?, ?, 'COD', 'Placed', ?)`,
      [userId, customerName, phone, address, city, pinCode, total],
    );

    const orderId = orderResult.lastID;

    for (const item of cartItems) {
      const lineTotal = item.quantity * item.price;
      await runSQL(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.product_name, item.quantity, item.price, lineTotal],
      );

      const stockUpdate = await runSQL(
        'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ? AND is_active = 1',
        [item.quantity, item.product_id, item.quantity],
      );
      if (stockUpdate.changes !== 1) {
        throw Object.assign(new Error(`Insufficient stock for "${item.product_name}".`), { status: 409 });
      }
      await runSQL('DELETE FROM cart_items WHERE id = ?', [item.cart_item_id]);
    }

    return { orderId, total };
  });
}
