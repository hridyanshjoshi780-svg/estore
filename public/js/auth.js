import { apiFetch, setToken, getToken } from './api.js';
import { showMessage, clearMessage, syncUserSession, updateAuthUI, initHeader } from './common.js';

async function handleAuthSubmit(event) {
  event.preventDefault();
  clearMessage();

  const form = event.currentTarget;
  const mode = form.dataset.mode;
  const payload = {
    name: form.querySelector('[name="name"]')?.value?.trim() || '',
    email: form.querySelector('[name="email"]')?.value?.trim() || '',
    password: form.querySelector('[name="password"]')?.value || '',
    role: form.querySelector('[name="role"]')?.value || 'customer',
  };

  if (mode === 'register' && !payload.name) {
    showMessage('error', 'Please enter your name.');
    return;
  }

  const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';

  try {
    const response = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setToken(response.token);
    localStorage.setItem('shopeasy_user', JSON.stringify(response.user));
    updateAuthUI();
    showMessage('success', mode === 'register' ? 'Registration successful. Redirecting...' : 'Login successful. Redirecting...');
    setTimeout(() => {
      const destination = response.user.role === 'admin'
        ? '/admin/dashboard.html'
        : response.user.role === 'seller'
          ? '/seller/dashboard.html'
          : '/index.html';
      window.location.href = destination;
    }, 600);
  } catch (error) {
    showMessage('error', error.message);
  }
}

const authForm = document.getElementById('auth-form');
if (authForm) {
  authForm.addEventListener('submit', handleAuthSubmit);
}

if (getToken()) {
  syncUserSession();
}

initHeader();
