import { apiFetch, authHeaders } from './api.js';
import { escapeHtml, formatMoney, initHeader, refreshCartFromServer, showMessage } from './common.js';

const form = document.getElementById('checkout-form');
const summary = document.getElementById('checkout-summary');

async function loadCheckoutSummary() {
  try {
    const cart = await apiFetch('/cart', { headers: authHeaders() });
    summary.innerHTML = `
      <div class="summary-box">
        <h3>Order Summary</h3>
        ${cart.items.map((item) => `
          <div class="summary-row">
            <span>${escapeHtml(item.name)} × ${item.quantity}</span>
            <strong>${formatMoney(item.line_total)}</strong>
          </div>
        `).join('')}
        <div class="summary-row summary-total"><span>Total</span><strong>${formatMoney(cart.total)}</strong></div>
        <div class="cod-box">Cash On Delivery</div>
      </div>
    `;
  } catch (error) {
    showMessage('error', error.message);
  }
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Placing order...';
    const formData = new FormData(form);

    try {
      const response = await apiFetch('/orders', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          customerName: formData.get('customerName'),
          phone: formData.get('phone'),
          address: formData.get('address'),
          city: formData.get('city'),
          pinCode: formData.get('pinCode'),
        }),
      });

      await refreshCartFromServer();
      showMessage('success', 'Order placed successfully. Redirecting...');
      setTimeout(() => {
        window.location.href = `/order-details.html?id=${response.order.id}`;
      }, 600);
    } catch (error) {
      showMessage('error', error.message);
      button.disabled = false;
      button.textContent = 'Place COD order';
    }
  });
}

(async () => {
  await initHeader();
  await loadCheckoutSummary();
})();
