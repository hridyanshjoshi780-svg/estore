import { apiFetch, authHeaders, getToken } from './api.js';
import { bindProductImageFallbacks, escapeHtml, formatMoney, initHeader, productImageSource, refreshCartFromServer, showMessage } from './common.js';

const searchInput = document.getElementById('product-search');
const categorySelect = document.getElementById('category-filter');
const homeGrid = document.getElementById('home-grid');
const productGrid = document.getElementById('product-grid');
const productDetail = document.getElementById('product-detail');
const searchButton = document.getElementById('search-submit');
const initialSearch = new URLSearchParams(window.location.search).get('q');

if (searchInput && initialSearch) searchInput.value = initialSearch;

function renderProductCard(product) {
  const inStock = Number(product.stock) > 0;
  const name = escapeHtml(product.name);
  const category = escapeHtml(product.category_name);
  const description = escapeHtml(product.description || '');
  const id = escapeHtml(product.id);

  return `
    <article class="product-card">
      <a class="product-thumb" href="/product.html?id=${encodeURIComponent(product.id)}" tabindex="-1" aria-hidden="true">
        <img data-product-image src="${escapeHtml(productImageSource(product.image_url))}" alt="" loading="lazy" width="480" height="360" />
      </a>
      <div class="product-meta">
        <span>${category}</span>
        <span class="stock ${inStock ? 'in' : 'out'}">${inStock ? `${product.stock} in stock` : 'Out of stock'}</span>
      </div>
      <h3>${name}</h3>
      <p>${description}</p>
      <div class="product-footer">
        <div class="price">${formatMoney(product.price)}</div>
        <div class="product-actions">
          <button class="secondary-btn" data-view="${id}" type="button">View</button>
          <button class="primary-btn" data-add="${id}" type="button" ${inStock ? '' : 'disabled'}>${inStock ? 'Add' : 'Sold out'}</button>
        </div>
      </div>
    </article>
  `;
}

async function addProductToCart(productId, button) {
  if (!getToken()) {
    window.location.href = '/login.html';
    return;
  }
  button.disabled = true;
  try {
    await apiFetch('/cart/items', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    await refreshCartFromServer();
    showMessage('success', 'Item added to cart.');
  } catch (error) {
    showMessage('error', error.message);
  } finally {
    button.disabled = false;
  }
}

function bindProductCardActions(list) {
  list.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      window.location.href = `/product.html?id=${encodeURIComponent(button.dataset.view)}`;
    });
  });
  list.querySelectorAll('[data-add]').forEach((button) => {
    button.addEventListener('click', () => addProductToCart(Number(button.dataset.add), button));
  });
}

async function loadCategories() {
  const categories = await apiFetch('/categories');
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">All categories</option>' + categories.map((category) =>
      `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`,
    ).join('');
  }

  const chips = document.getElementById('category-chips');
  if (chips) {
    const categoryArtwork = {
      electronics: '/images/categories/electronics.svg',
      fashion: '/images/categories/fashion.svg',
      'home & living': '/images/categories/home-living.svg',
    };
    chips.innerHTML = categories.map((category) => {
      const image = categoryArtwork[String(category.name).toLowerCase()] || '/images/placeholders/product.svg';
      return `<button class="category-card" data-category="${escapeHtml(category.id)}" type="button">
        <img src="${image}" alt="" loading="lazy" width="480" height="300" />
        <span>${escapeHtml(category.name)}</span>
      </button>`;
    }).join('');
    chips.querySelectorAll('.category-card').forEach((button) => {
      button.addEventListener('click', () => {
        if (categorySelect) categorySelect.value = button.dataset.category;
        chips.querySelectorAll('.category-card').forEach((card) => card.classList.toggle('active', card === button));
        loadProducts();
      });
    });
  }
}

async function loadProducts() {
  const list = homeGrid || productGrid;
  if (!list) return;
  list.innerHTML = '<p class="loading-state">Loading products…</p>';
  try {
    const params = new URLSearchParams();
    if (searchInput?.value.trim()) params.set('q', searchInput.value.trim());
    if (categorySelect?.value) params.set('category', categorySelect.value);
    const products = await apiFetch(`/products?${params.toString()}`);

    if (!products.length) {
      list.innerHTML = '<div class="empty-state">No products match your filters.</div>';
      return;
    }
    list.innerHTML = products.map(renderProductCard).join('');
    bindProductImageFallbacks(list);
    bindProductCardActions(list);
  } catch (error) {
    list.innerHTML = '<div class="empty-state">Products could not be loaded.</div>';
    showMessage('error', error.message);
  }
}

async function loadProductDetail() {
  const productId = new URLSearchParams(window.location.search).get('id');
  if (!productId || !/^\d+$/.test(productId)) {
    productDetail.innerHTML = '<div class="empty-state">Choose a valid product to view its details.</div>';
    return;
  }

  productDetail.innerHTML = '<p class="loading-state">Loading product details…</p>';
  try {
    const product = await apiFetch(`/products/${encodeURIComponent(productId)}`);
    const inStock = Number(product.stock) > 0;
    productDetail.innerHTML = `
      <div class="product-detail-image">
        <img data-product-image src="${escapeHtml(productImageSource(product.image_url))}" alt="${escapeHtml(product.name)}" width="640" height="480" />
      </div>
      <div class="product-detail-copy panel">
        <p class="eyebrow">${escapeHtml(product.category_name)}</p>
        <h1>${escapeHtml(product.name)}</h1>
        <p>${escapeHtml(product.description || 'No description available.')}</p>
        <div class="detail-metrics">
          <span class="detail-price">${formatMoney(product.price)}</span>
          <span class="stock ${inStock ? 'in' : 'out'}">${inStock ? `${product.stock} in stock` : 'Out of stock'}</span>
        </div>
        <button class="primary-btn" id="product-detail-add" type="button" ${inStock ? '' : 'disabled'}>${inStock ? 'Add to cart' : 'Sold out'}</button>
      </div>
    `;
    bindProductImageFallbacks(productDetail);
    const button = document.getElementById('product-detail-add');
    if (inStock) button.addEventListener('click', () => addProductToCart(product.id, button));
  } catch (error) {
    productDetail.innerHTML = '<div class="empty-state">Product details could not be loaded.</div>';
    showMessage('error', error.message);
  }
}

searchInput?.addEventListener('input', () => {
  if (homeGrid || productGrid) loadProducts();
});
categorySelect?.addEventListener('change', () => loadProducts());
searchButton?.addEventListener('click', () => {
  if (homeGrid || productGrid) loadProducts();
  else if (searchInput?.value.trim()) {
    window.location.href = `/index.html?q=${encodeURIComponent(searchInput.value.trim())}#catalogue`;
  }
});

(async () => {
  await initHeader();
  if (productDetail) {
    await loadProductDetail();
    return;
  }
  await loadCategories();
  await loadProducts();
})();
