import { apiFetch, authHeaders } from './api.js';
import { bindProductImageFallbacks, escapeHtml, formatMoney, initHeader, productImageSource, refreshCartFromServer, showMessage } from './common.js';

const cartContainer = document.getElementById('cart-container');

async function loadCart() {
  const token = localStorage.getItem('shopeasy_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  try {
    const response = await apiFetch('/cart', { headers: authHeaders() });
    if (!response.items.length) {
      cartContainer.innerHTML = '<div class="empty-state">Your cart is empty. Add a few essentials to continue.</div>';
      return;
    }

    cartContainer.innerHTML = `
      <div class="summary-box">
        <div class="cart-item-card">
          <div><strong>Item</strong></div>
          <div><strong>Name</strong></div>
          <div><strong>Price</strong></div>
          <div><strong>Qty</strong></div>
          <div><strong>Total</strong></div>
        </div>
        ${response.items.map((item) => `
          <div class="cart-item-card">
            <div class="cart-thumb"><img data-product-image src="${escapeHtml(productImageSource(item.image_url))}" alt="${escapeHtml(item.name)}" loading="lazy" width="110" height="110" /></div>
            <div>
              <strong>${escapeHtml(item.name)}</strong><br>
              <span class="text-muted">${item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}</span>
            </div>
            <div>${formatMoney(item.price)}</div>
            <div class="qty-control">
              <button class="qty-btn" type="button" data-decrease="${escapeHtml(item.cart_item_id)}" aria-label="Decrease quantity">-</button>
              <span>${item.quantity}</span>
              <button class="qty-btn" type="button" data-increase="${escapeHtml(item.cart_item_id)}" aria-label="Increase quantity">+</button>
            </div>
            <div>
              <strong>${formatMoney(item.line_total)}</strong><br>
              <button class="btn-link" type="button" data-remove="${escapeHtml(item.cart_item_id)}">Remove</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="summary-card">
        <h3>Order Summary</h3>
        <div class="summary-row"><span>Subtotal</span><strong>${formatMoney(response.total)}</strong></div>
        <div class="summary-row"><span>Shipping</span><strong>₹0</strong></div>
        <div class="summary-row summary-total"><span>Total</span><strong>${formatMoney(response.total)}</strong></div>
        <a href="/checkout.html" class="primary-btn wide-button summary-checkout-link">Proceed to checkout</a>
      </div>
    `;
    bindProductImageFallbacks(cartContainer);

    cartContainer.querySelectorAll('[data-increase]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        const id = Number(button.dataset.increase);
        const item = response.items.find((entry) => entry.cart_item_id === id);
        try {
          await apiFetch(`/cart/items/${id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ quantity: Number(item.quantity) + 1 }),
          });
          await loadCart();
          await refreshCartFromServer();
        } catch (error) {
          showMessage('error', error.message);
          button.disabled = false;
        }
      });
    });

    cartContainer.querySelectorAll('[data-decrease]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        const id = Number(button.dataset.decrease);
        const item = response.items.find((entry) => entry.cart_item_id === id);
        const next = Number(item.quantity) - 1;
        try {
          if (next <= 0) {
            await apiFetch(`/cart/items/${id}`, { method: 'DELETE', headers: authHeaders() });
          } else {
            await apiFetch(`/cart/items/${id}`, {
              method: 'PATCH',
              headers: authHeaders(),
              body: JSON.stringify({ quantity: next }),
            });
          }
          await loadCart();
          await refreshCartFromServer();
        } catch (error) {
          showMessage('error', error.message);
          button.disabled = false;
        }
      });
    });

    cartContainer.querySelectorAll('[data-remove]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await apiFetch(`/cart/items/${button.dataset.remove}`, { method: 'DELETE', headers: authHeaders() });
          await loadCart();
          await refreshCartFromServer();
        } catch (error) {
          showMessage('error', error.message);
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    showMessage('error', error.message);
  }
}

(async () => {
  await initHeader();
  await loadCart();
})();
