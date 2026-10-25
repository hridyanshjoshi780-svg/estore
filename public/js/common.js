import { apiFetch, authHeaders, getToken, setToken } from './api.js';

const navLinks = document.querySelectorAll('[data-nav]');
const cartCountEl = document.getElementById('cart-count');
const authStatusEl = document.getElementById('account-status');
const authButton = document.getElementById('auth-button');
const logoutButton = document.getElementById('logout-button');

function getUserFromStorage() {
  try {
    const raw = localStorage.getItem('shopeasy_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setUserInStorage(user) {
  if (!user) {
    localStorage.removeItem('shopeasy_user');
    return;
  }
  localStorage.setItem('shopeasy_user', JSON.stringify(user));
}

export function showMessage(type, message) {
  const alert = document.getElementById('form-alert');
  if (!alert) return;
  alert.className = `alert ${type} show`;
  alert.textContent = message;
}

export function clearMessage() {
  const alert = document.getElementById('form-alert');
  if (!alert) return;
  alert.className = 'alert';
  alert.textContent = '';
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function productImageSource(value) {
  const source = String(value ?? '').trim();
  if (/^\/images\/products\/[a-z0-9-]+\.svg$/i.test(source)) return source;
  try {
    const url = new URL(source);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch {
    return '/images/placeholders/product.svg';
  }
  return '/images/placeholders/product.svg';
}

export function bindProductImageFallbacks(root) {
  root.querySelectorAll('img[data-product-image]').forEach((image) => {
    image.addEventListener('error', () => {
      image.src = '/images/placeholders/product.svg';
      image.dataset.productImage = 'fallback';
    }, { once: true });
  });
}

export function updateCartBadge() {
  let cart = {};
  try {
    cart = JSON.parse(localStorage.getItem('shopeasy_cart') || '{}');
  } catch {
    localStorage.removeItem('shopeasy_cart');
  }
  const count = Number(cart.count || 0);
  if (cartCountEl) {
    cartCountEl.textContent = String(count);
  }
  return count;
}

export async function refreshCartFromServer() {
  const token = getToken();
  if (!token) {
    localStorage.removeItem('shopeasy_cart');
    updateCartBadge();
    return;
  }

  try {
    const response = await apiFetch('/cart', { headers: authHeaders() });
    const count = response.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    localStorage.setItem('shopeasy_cart', JSON.stringify({ count, updatedAt: Date.now() }));
    updateCartBadge();
  } catch (error) {
    showMessage('error', error.message);
  }
}

export function updateAuthUI() {
  const user = getUserFromStorage();
  if (authStatusEl) {
    authStatusEl.textContent = user ? `Hi, ${user.name.split(' ')[0]}` : 'Account';
  }

  if (authButton) {
    authButton.classList.toggle('hidden', Boolean(user));
  }

  if (logoutButton) {
    logoutButton.classList.toggle('hidden', !user);
  }

  const adminLinks = document.querySelectorAll('[data-admin-link]');
  adminLinks.forEach((link) => {
    link.classList.toggle('hidden', !(user && user.role === 'admin'));
  });
  document.querySelectorAll('[data-seller-link]').forEach((link) => {
    link.classList.toggle('hidden', !(user && user.role === 'seller'));
  });
}

export async function syncUserSession() {
  const token = getToken();
  if (!token) {
    setUserInStorage(null);
    updateAuthUI();
    return null;
  }

  try {
    const response = await apiFetch('/auth/me', { headers: authHeaders() });
    setUserInStorage(response.user);
    updateAuthUI();
    return response.user;
  } catch {
    setToken(null);
    setUserInStorage(null);
    updateAuthUI();
    return null;
  }
}

export function wireSharedLinks() {
  navLinks.forEach((link) => {
    const target = link.dataset.nav;
    if (!target) return;
    link.addEventListener('click', (event) => {
      if (target === 'logout') {
        event.preventDefault();
        setToken(null);
        setUserInStorage(null);
        updateAuthUI();
        window.location.href = '/index.html';
        return;
      }
      if (target === 'orders') {
        event.preventDefault();
        window.location.href = '/orders.html';
        return;
      }
      if (target === 'cart') {
        event.preventDefault();
        window.location.href = '/cart.html';
        return;
      }
      if (target === 'login') {
        event.preventDefault();
        window.location.href = '/login.html';
        return;
      }
      if (target === 'register') {
        event.preventDefault();
        window.location.href = '/register.html';
        return;
      }
      if (target === 'admin') {
        event.preventDefault();
        window.location.href = '/admin/dashboard.html';
      }
      if (target === 'seller') {
        event.preventDefault();
        window.location.href = '/seller/dashboard.html';
      }
    });
  });

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      setToken(null);
      setUserInStorage(null);
      updateAuthUI();
      window.location.href = '/login.html';
    });
  }
}

export async function initHeader() {
  updateCartBadge();
  wireSharedLinks();
  await syncUserSession();
  await refreshCartFromServer();
  updateAuthUI();
}
