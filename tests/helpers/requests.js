import worker from '../../src/index.js';
import { loadTestEnv } from './env.js';

export function makeRequest(url, {
  method = 'GET',
  host,
  body,
  cookie,
  headers = {},
} = {}) {
  const finalHeaders = new Headers(headers);
  if (host) finalHeaders.set('host', host);
  if (cookie) finalHeaders.set('cookie', cookie);
  if (body !== undefined) {
    finalHeaders.set('content-type', 'application/json');
  }

  return new Request(url, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function fetchWorker(url, options = {}) {
  const { envOverrides = {}, ...requestOptions } = options;
  const env = loadTestEnv(envOverrides);
  const request = makeRequest(url, requestOptions);
  return worker.fetch(request, env);
}

export async function readJson(response) {
  return response.json();
}

export function getCookie(response, name) {
  const raw = response.headers.get('set-cookie');
  if (!raw) return null;
  const match = raw.split(';').find((part) => part.trim().startsWith(`${name}=`));
  return match?.trim() ?? null;
}
