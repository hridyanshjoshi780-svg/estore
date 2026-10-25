const API_BASE_URL = '/api';

export async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const requestOptions = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, requestOptions);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }
  return payload;
}

export function getToken() {
  return localStorage.getItem('shopeasy_token');
}

export function setToken(token) {
  if (!token) {
    localStorage.removeItem('shopeasy_token');
    return;
  }
  localStorage.setItem('shopeasy_token', token);
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
