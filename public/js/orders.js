import { apiFetch, authHeaders } from './api.js';
import { escapeHtml, formatMoney, initHeader, showMessage } from './common.js';

const orderList = document.getElementById('order-list');
const detailContainer = document.getElementById('order-detail-container');

async function loadOrders() {
  const token = localStorage.getItem('shopeasy_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  try {
    const orders = await apiFetch('/orders', { headers: authHeaders() });
    if (!orders.length) {
      orderList.innerHTML = '<div class="empty-state">You have not placed any orders yet.</div>';
      return;
    }

    orderList.innerHTML = orders.map((order) => `
      <article class="order-card">
        <div class="order-card-header">
          <div>
            <strong>Order #${escapeHtml(order.id)}</strong>
            <div class="text-muted">${escapeHtml(new Date(order.created_at).toLocaleDateString('en-IN'))}</div>
          </div>
          <span class="badge ${order.status === 'Placed' ? 'warning' : order.status === 'Shipped' ? 'info' : 'success'}">${escapeHtml(order.status)}</span>
        </div>
        <div class="meta-row"><span>Total</span><strong>${formatMoney(order.total)}</strong></div>
        <div class="inline-actions">
          <a class="secondary-btn" href="/order-details.html?id=${encodeURIComponent(order.id)}">Details</a>
        </div>
      </article>
    `).join('');
  } catch (error) {
    showMessage('error', error.message);
  }
}

async function loadOrderDetail() {
  if (!detailContainer) return;
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('id');
  if (!orderId) {
    detailContainer.innerHTML = '<div class="empty-state">No order selected.</div>';
    return;
  }

  try {
    const response = await apiFetch(`/orders/${orderId}`, { headers: authHeaders() });
    const order = response.order;
    const items = response.items;

    detailContainer.innerHTML = `
      <div class="panel">
        <div class="order-card-header">
          <div>
            <h2>Order #${escapeHtml(order.id)}</h2>
            <div class="text-muted">${escapeHtml(new Date(order.created_at).toLocaleDateString('en-IN'))}</div>
          </div>
          <span class="badge ${order.status === 'Placed' ? 'warning' : order.status === 'Shipped' ? 'info' : 'success'}">${escapeHtml(order.status)}</span>
        </div>
        <div class="list-rows">
          <div class="meta-row"><span>Customer</span><strong>${escapeHtml(order.customer_name)}</strong></div>
          <div class="meta-row"><span>Phone</span><strong>${escapeHtml(order.phone)}</strong></div>
          <div class="meta-row"><span>Address</span><strong>${escapeHtml(order.address)}, ${escapeHtml(order.city)}, ${escapeHtml(order.pin_code)}</strong></div>
        </div>
        <h3>Items</h3>
        <div class="list-rows">
          ${items.map((item) => `
            <div class="meta-row">
              <span>${escapeHtml(item.product_name)} × ${item.quantity}</span>
              <strong>${formatMoney(item.line_total)}</strong>
            </div>
          `).join('')}
        </div>
        <div class="meta-row summary-total"><span>Total</span><strong>${formatMoney(order.total)}</strong></div>
      </div>
    `;
  } catch (error) {
    showMessage('error', error.message);
  }
}

(async () => {
  await initHeader();
  if (orderList) await loadOrders();
  await loadOrderDetail();
})();
