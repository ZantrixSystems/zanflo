/**
 * API client for the backend.
 *
 * All requests:
 * - include credentials (session cookie)
 * - send X-Tenant-Slug header (resolved from env var at build time)
 * - are JSON in, JSON out
 *
 * VITE_API_URL and VITE_TENANT_SLUG must be set in frontend/.env.local
 */

const API_URL    = import.meta.env.VITE_API_URL    || 'http://localhost:8787';
const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'riverside';

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type':  'application/json',
      'X-Tenant-Slug': TENANT_SLUG,
    },
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, opts);

  // Parse JSON regardless of status — the body always tells us what went wrong
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data;
}

export const api = {
  // Applicant auth
  register: (body)   => request('POST', '/applicant/register', body),
  login:    (body)   => request('POST', '/applicant/login', body),
  logout:   ()       => request('POST', '/applicant/logout'),
  me:       ()       => request('GET',  '/applicant/me'),

  // Application types
  getApplicationTypes: () => request('GET', '/application-types'),

  // Applications
  createApplication:  (body) => request('POST', '/applications', body),
  listApplications:   ()     => request('GET',  '/applications'),
  getApplication:     (id)   => request('GET',  `/applications/${id}`),
  updateApplication:  (id, body) => request('PUT', `/applications/${id}`, body),
  submitApplication:  (id)   => request('POST', `/applications/${id}/submit`),
};
