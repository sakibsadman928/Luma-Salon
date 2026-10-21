// Centralised API client. All queue data shown in the UI comes from these calls.
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const KEY = 'luma_staff_token';

export const tokenStore = {
  get: () => sessionStorage.getItem(KEY),
  set: (t) => sessionStorage.setItem(KEY, t),
  clear: () => sessionStorage.removeItem(KEY),
};

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && tokenStore.get()) headers.Authorization = `Bearer ${tokenStore.get()}`;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK');
  }
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok || !json?.success) {
    if (res.status === 401 && auth) {
      tokenStore.clear();
      window.dispatchEvent(new Event('luma:unauthorized'));
    }
    throw new ApiError(json?.error?.message || `Request failed (${res.status})`, res.status, json?.error?.code);
  }
  return json.data;
}

export const api = {
  // public
  publicQueue: () => request('/api/queue/public'),
  publicToken: (token) => request(`/api/queue/public/${encodeURIComponent(token)}`),
  // auth
  login: (pin) => request('/api/auth/login', { method: 'POST', body: { pin } }),
  logout: () => request('/api/auth/logout', { method: 'POST', auth: true }),
  // staff
  today: () => request('/api/queue/today', { auth: true }),
  addWalkIn: (customerName) => request('/api/queue/walk-ins', { method: 'POST', body: { customerName }, auth: true }),
  addAppointment: (payload) => request('/api/queue/appointments', { method: 'POST', body: payload, auth: true }),
  callNext: () => request('/api/queue/call-next', { method: 'POST', auth: true }),
  checkIn: (id) => request(`/api/queue/${id}/check-in`, { method: 'POST', auth: true }),
  start: (id) => request(`/api/queue/${id}/start`, { method: 'POST', auth: true }),
  complete: (id) => request(`/api/queue/${id}/complete`, { method: 'POST', auth: true }),
  cancel: (id) => request(`/api/queue/${id}/cancel`, { method: 'POST', auth: true }),
};
