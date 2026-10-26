import { authEnabled, getAccessToken, refreshSession, signOut } from './auth';

// Set EXPO_PUBLIC_API_URL in .env, e.g. http://192.168.1.20:8000
// (use your computer's LAN IP, not localhost, when testing on a physical phone)
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function send(path, options) {
  const headers = { ...(options?.headers ?? { 'Content-Type': 'application/json' }) };
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

export async function request(path, options) {
  let res;
  try {
    res = await send(path, options);
    // An expired login: renew it once and try again; if that fails the learner is signed out.
    if (res.status === 401 && authEnabled) {
      if (await refreshSession()) res = await send(path, options);
      if (res.status === 401) await signOut();
    }
  } catch (e) {
    throw new ApiError(0, "Can't reach the server. Is the backend running?");
  }
  if (!res.ok) {
    let detail = res.statusText || `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch (e) {
      // keep the status text
    }
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

export const post = (path, body) =>
  request(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

// Sends FormData (file uploads). `headers: {}` removes the JSON Content-Type so the
// browser / React Native can add the multipart boundary itself.
export const postForm = (path, form) => request(path, { method: 'POST', body: form, headers: {} });
