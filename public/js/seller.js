import { apiFetch, authHeaders, getToken } from './api.js';
import { bindProductImageFallbacks, escapeHtml, formatMoney, initHeader, productImageSource, showMessage } from './common.js';

const statsTarget = document.getElementById('seller-stats');
const summaryTarget = document.getElementById('seller-product-summary');
const productsTarget = document.getElementById('seller-products-table');
const ordersTarget = document.getElementById('seller-orders');
const productForm = document.getElementById('seller-product-form');

async function ensureSellerAccess() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return false;
  }

  try {
    const { user } = await apiFetch('/auth/me', { headers: authHeaders() });
    if (user.role !== 'seller') {
      window.location.href = user.role === 'admin' ? '/admin/dashboard.html' : '/index.html';
      return false;
    }
    return true;
  } catch (error) {
    showMessage('error', error.message);
    return false;
  }
}

async function loadSellerDashboard() {
  const [stats, products] = await Promise.all([
    apiFetch('/seller/stats', { headers: authHeaders() }),
    apiFetch('/seller/products', { headers: authHeaders() }),
  ]);

  if (statsTarget) {
    statsTarget.innerHTML = `
      <div class="stat-card"><span>Products</span><strong>${stats.products.total_products}</strong></div>
      <div class="stat-card"><span>Active products</span><strong>${stats.products.active_products || 0}</strong></div>
      <div class="stat-card"><span>Orders with your products</span><strong>${stats.orders.total_orders}</strong></div>
    `;
  }
  if (summaryTarget) {
    summaryTarget.innerHTML = products.length
      ? `<table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead><tbody>
        ${products.slice(0, 8).map((product) => `
          <tr>
            <td class="admin-product-name"><img data-product-image src="${escapeHtml(productImageSource(product.image_url))}" alt="" loading="lazy" width="48" height="48" />${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.category_name)}</td>
            <td>${formatMoney(product.price)}</td>
            <td>${product.stock}</td>
            <td>${product.is_active ? 'Active' : 'Inactive'}</td>
          </tr>`).join('')}
        </tbody></table>`
      : '<p class="empty-state">You have not added any products yet.</p>';
    bindProductImageFallbacks(summaryTarget);
  }
}

async function loadCategories() {
  const select = document.getElementById('seller-product-category');
  if (!select) return;
  const categories = await apiFetch('/categories');
  select.innerHTML = categories.map((category) =>
    `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`,
  ).join('');
}

async function loadSellerProducts() {
  if (!productsTarget) return;
  const products = await apiFetch('/seller/products', { headers: authHeaders() });
  productsTarget.innerHTML = products.length
    ? `<table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${products.map((product) => `
        <tr>
          <td class="admin-product-name"><img data-product-image src="${escapeHtml(productImageSource(product.image_url))}" alt="" loading="lazy" width="48" height="48" />${escapeHtml(product.name)}</td>
          <td>${escapeHtml(product.category_name)}</td>
          <td>${formatMoney(product.price)}</td>
          <td>${product.stock}</td>
          <td>${product.is_active ? 'Active' : 'Inactive'}</td>
          <td class="inline-actions">
            <button class="secondary-btn" type="button" data-edit-product="${escapeHtml(product.id)}">Edit</button>
            ${product.is_active ? `<button class="secondary-btn" type="button" data-deactivate-product="${escapeHtml(product.id)}">Deactivate</button>` : ''}
          </td>
        </tr>`).join('')}
      </tbody></table>`
    : '<p class="empty-state">No products yet. Use the form above to add your first product.</p>';
  bindProductImageFallbacks(productsTarget);

  productsTarget.querySelectorAll('[data-edit-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = products.find((item) => item.id === Number(button.dataset.editProduct));
      if (!product) return;
      document.getElementById('seller-product-id').value = product.id;
      document.getElementById('seller-product-name').value = product.name;
      document.getElementById('seller-product-category').value = product.category_id;
      document.getElementById('seller-product-price').value = product.price;
      document.getElementById('seller-product-stock').value = product.stock;
      document.getElementById('seller-product-image').value = product.image_url || '';
      document.getElementById('seller-product-description').value = product.description || '';
      document.getElementById('seller-product-active').checked = Boolean(product.is_active);
      document.getElementById('seller-product-form-title').textContent = 'Edit product';
      document.getElementById('seller-product-submit').textContent = 'Save changes';
      document.getElementById('seller-product-cancel').classList.remove('hidden');
      productForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  productsTarget.querySelectorAll('[data-deactivate-product]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await apiFetch(`/seller/products/${button.dataset.deactivateProduct}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        showMessage('success', 'Product deactivated.');
        await loadSellerProducts();
        await loadSellerDashboard();
      } catch (error) {
        showMessage('error', error.message);
        button.disabled = false;
      }
    });
  });
}

function resetProductForm() {
  productForm.reset();
  document.getElementById('seller-product-id').value = '';
  document.getElementById('seller-product-form-title').textContent = 'Add a product';
  document.getElementById('seller-product-submit').textContent = 'Add product';
  document.getElementById('seller-product-cancel').classList.add('hidden');
}

async function submitProductForm(event) {
  event.preventDefault();
  const productId = document.getElementById('seller-product-id').value;
  const submit = document.getElementById('seller-product-submit');
  const payload = {
    categoryId: Number(document.getElementById('seller-product-category').value),
    name: document.getElementById('seller-product-name').value.trim(),
    description: document.getElementById('seller-product-description').value.trim(),
    price: Number(document.getElementById('seller-product-price').value),
    stock: Number(document.getElementById('seller-product-stock').value),
    imageUrl: document.getElementById('seller-product-image').value.trim(),
    isActive: document.getElementById('seller-product-active').checked,
  };
  submit.disabled = true;

  try {
    await apiFetch(productId ? `/seller/products/${productId}` : '/seller/products', {
      method: productId ? 'PUT' : 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    showMessage('success', productId ? 'Product updated.' : 'Product created.');
    resetProductForm();
    await Promise.all([loadSellerProducts(), loadSellerDashboard()]);
  } catch (error) {
    showMessage('error', error.message);
  } finally {
    submit.disabled = false;
  }
}

async function loadSellerOrders() {
  if (!ordersTarget) return;
  const orders = await apiFetch('/seller/orders', { headers: authHeaders() });
  ordersTarget.innerHTML = orders.length
    ? orders.map((order) => `
      <article class="order-card">
        <div class="order-card-header">
          <div>
            <strong>Order #${escapeHtml(order.id)}</strong>
            <div class="text-muted">${escapeHtml(new Date(order.created_at).toLocaleDateString('en-IN'))}</div>
          </div>
          <span class="badge">${escapeHtml(order.status)}</span>
        </div>
        <div class="meta-row"><span>Your items total</span><strong>${formatMoney(order.seller_total)}</strong></div>
        <div class="meta-row"><span>Line items</span><strong>${order.item_count}</strong></div>
        <button class="secondary-btn" type="button" data-seller-order="${escapeHtml(order.id)}">View your order items</button>
        <div class="seller-order-detail" id="seller-order-detail-${escapeHtml(order.id)}"></div>
      </article>`).join('')
    : '<p class="empty-state">No orders contain your products yet.</p>';

  ordersTarget.querySelectorAll('[data-seller-order]').forEach((button) => {
    button.addEventListener('click', async () => {
      const orderId = button.dataset.sellerOrder;
      const target = document.getElementById(`seller-order-detail-${orderId}`);
      button.disabled = true;
      try {
        const detail = await apiFetch(`/seller/orders/${orderId}`, { headers: authHeaders() });
        target.innerHTML = `<ul>${detail.items.map((item) => `
          <li>${escapeHtml(item.product_name)} × ${item.quantity} — ${formatMoney(item.line_total)}</li>
        `).join('')}</ul>`;
      } catch (error) {
        showMessage('error', error.message);
      } finally {
        button.disabled = false;
      }
    });
  });
}

(async () => {
  await initHeader();
  if (!(await ensureSellerAccess())) return;

  try {
    await Promise.all([loadSellerDashboard(), loadCategories(), loadSellerProducts(), loadSellerOrders()]);
  } catch (error) {
    showMessage('error', error.message);
  }

  if (productForm) productForm.addEventListener('submit', submitProductForm);
  document.getElementById('seller-product-cancel')?.addEventListener('click', resetProductForm);
})();
