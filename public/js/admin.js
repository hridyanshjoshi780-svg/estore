import { apiFetch, authHeaders, getToken } from './api.js';
import { bindProductImageFallbacks, escapeHtml, formatMoney, initHeader, productImageSource, showMessage } from './common.js';

const statTarget = document.getElementById('dashboard-stats');
const categoryForm = document.getElementById('category-form');
const productForm = document.getElementById('product-form');
const orderTable = document.getElementById('admin-order-table');
const productTable = document.getElementById('admin-products-table');
const categoryTable = document.getElementById('admin-categories-table');

async function ensureAdminAccess() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return false;
  }

  try {
    const { user } = await apiFetch('/auth/me', { headers: authHeaders() });
    if (user.role !== 'admin') {
      window.location.href = user.role === 'seller' ? '/seller/dashboard.html' : '/index.html';
      return false;
    }
    return true;
  } catch (error) {
    showMessage('error', error.message);
    return false;
  }
}

async function loadDashboardStats() {
  if (!statTarget) return;
  const stats = await apiFetch('/admin/stats', { headers: authHeaders() });
  statTarget.innerHTML = `
    <div class="stat-card"><span>Total Orders</span><strong>${stats.orders.total_orders}</strong></div>
    <div class="stat-card"><span>Revenue</span><strong>${formatMoney(stats.orders.total_revenue)}</strong></div>
    <div class="stat-card"><span>Active Products</span><strong>${stats.products.active_products || 0}</strong></div>
    <div class="stat-card"><span>Total Users</span><strong>${stats.users.total_users}</strong></div>
  `;
}

async function loadAdminOrders() {
  if (!orderTable) return;
  const orders = await apiFetch('/admin/orders', { headers: authHeaders() });
  orderTable.innerHTML = `
    <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Update</th></tr></thead>
    <tbody>${orders.map((order) => `
      <tr>
        <td>#${escapeHtml(order.id)}</td>
        <td>${escapeHtml(order.customer_name)}</td>
        <td>${escapeHtml(order.status)}</td>
        <td>${formatMoney(order.total)}</td>
        <td>
          <select data-status-order="${escapeHtml(order.id)}" aria-label="Update status for order ${escapeHtml(order.id)}">
            ${['Placed', 'Shipped', 'Delivered'].map((status) =>
              `<option value="${status}" ${order.status === status ? 'selected' : ''}>${status}</option>`,
            ).join('')}
          </select>
        </td>
      </tr>`).join('')}
    </tbody>
  `;
  orderTable.querySelectorAll('[data-status-order]').forEach((select) => {
    select.addEventListener('change', async () => {
      select.disabled = true;
      try {
        await apiFetch(`/orders/admin/${select.dataset.statusOrder}/status`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ status: select.value }),
        });
        showMessage('success', 'Order status updated.');
      } catch (error) {
        showMessage('error', error.message);
        await loadAdminOrders();
      } finally {
        select.disabled = false;
      }
    });
  });
}

async function loadCategoriesForAdmin() {
  const categories = await apiFetch('/admin/categories', { headers: authHeaders() });
  const select = document.getElementById('product-category');
  if (select) {
    select.innerHTML = categories.map((category) =>
      `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`,
    ).join('');
  }

  if (categoryTable) {
    categoryTable.innerHTML = categories.length
      ? `<table><thead><tr><th>Category</th><th>Actions</th></tr></thead><tbody>
        ${categories.map((category) => `
          <tr><td>${escapeHtml(category.name)}</td><td class="inline-actions">
            <button class="secondary-btn" type="button" data-edit-category="${escapeHtml(category.id)}">Rename</button>
            <button class="secondary-btn" type="button" data-delete-category="${escapeHtml(category.id)}">Delete</button>
          </td></tr>`).join('')}
        </tbody></table>`
      : '<p class="empty-state">No categories found.</p>';

    categoryTable.querySelectorAll('[data-edit-category]').forEach((button) => {
      button.addEventListener('click', async () => {
        const category = categories.find((item) => item.id === Number(button.dataset.editCategory));
        const name = window.prompt('Enter a new category name:', category?.name || '');
        if (name === null) return;
        try {
          await apiFetch(`/admin/categories/${button.dataset.editCategory}`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ name }),
          });
          showMessage('success', 'Category updated.');
          await loadCategoriesForAdmin();
        } catch (error) {
          showMessage('error', error.message);
        }
      });
    });

    categoryTable.querySelectorAll('[data-delete-category]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!window.confirm('Delete this category? Categories with products cannot be deleted.')) return;
        try {
          await apiFetch(`/admin/categories/${button.dataset.deleteCategory}`, {
            method: 'DELETE',
            headers: authHeaders(),
          });
          showMessage('success', 'Category deleted.');
          await loadCategoriesForAdmin();
        } catch (error) {
          showMessage('error', error.message);
        }
      });
    });
  }
}

async function loadAdminProducts() {
  if (!productTable) return;
  const products = await apiFetch('/admin/products', { headers: authHeaders() });
  productTable.innerHTML = products.length
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
    : '<p class="empty-state">No products found.</p>';

  productTable.querySelectorAll('[data-edit-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = products.find((item) => item.id === Number(button.dataset.editProduct));
      if (!product || !productForm) return;
      document.getElementById('product-id').value = product.id;
      document.getElementById('product-category').value = product.category_id;
      document.getElementById('product-name').value = product.name;
      document.getElementById('product-description').value = product.description || '';
      document.getElementById('product-price').value = product.price;
      document.getElementById('product-stock').value = product.stock;
      document.getElementById('product-image-url').value = product.image_url || '';
      document.getElementById('product-active').checked = Boolean(product.is_active);
      document.getElementById('product-form-title').textContent = 'Edit product';
      document.getElementById('product-submit').textContent = 'Save changes';
      document.getElementById('product-cancel').classList.remove('hidden');
      productForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  bindProductImageFallbacks(productTable);

  productTable.querySelectorAll('[data-deactivate-product]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await apiFetch(`/admin/products/${button.dataset.deactivateProduct}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        showMessage('success', 'Product deactivated.');
        await loadAdminProducts();
        await loadDashboardStats();
      } catch (error) {
        showMessage('error', error.message);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function resetProductForm() {
  productForm.reset();
  document.getElementById('product-id').value = '';
  document.getElementById('product-form-title').textContent = 'Add product';
  document.getElementById('product-submit').textContent = 'Create product';
  document.getElementById('product-cancel').classList.add('hidden');
}

if (categoryForm) {
  categoryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('category-name');
    try {
      await apiFetch('/admin/categories', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: input.value.trim() }),
      });
      categoryForm.reset();
      showMessage('success', 'Category created.');
      await loadCategoriesForAdmin();
    } catch (error) {
      showMessage('error', error.message);
    }
  });
}

if (productForm) {
  productForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('product-id').value;
    const submit = document.getElementById('product-submit');
    const payload = {
      categoryId: Number(document.getElementById('product-category').value),
      name: document.getElementById('product-name').value.trim(),
      description: document.getElementById('product-description').value.trim(),
      price: Number(document.getElementById('product-price').value),
      stock: Number(document.getElementById('product-stock').value),
      imageUrl: document.getElementById('product-image-url').value.trim(),
      isActive: document.getElementById('product-active')?.checked ?? true,
    };
    submit.disabled = true;
    try {
      await apiFetch(id ? `/admin/products/${id}` : '/admin/products', {
        method: id ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      showMessage('success', id ? 'Product updated.' : 'Product created.');
      resetProductForm();
      await Promise.all([loadAdminProducts(), loadDashboardStats()]);
    } catch (error) {
      showMessage('error', error.message);
    } finally {
      submit.disabled = false;
    }
  });
  document.getElementById('product-cancel')?.addEventListener('click', resetProductForm);
}

(async () => {
  await initHeader();
  if (!(await ensureAdminAccess())) return;
  try {
    await Promise.all([
      loadDashboardStats(),
      loadAdminOrders(),
      loadCategoriesForAdmin(),
      loadAdminProducts(),
    ]);
  } catch (error) {
    showMessage('error', error.message);
  }
})();
