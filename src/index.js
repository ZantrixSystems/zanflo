/**
 * Main worker entry point.
 *
 * Route dispatch order:
 *  1. CORS preflight — must be first so browsers don't get blocked
 *  2. Staff auth      — /auth/*
 *  3. Applicant auth  — /applicant/register, /applicant/login, etc.
 *  4. Application types — /application-types
 *  5. Applications    — /applications/*
 *  6. 404
 *
 * Environment variables required:
 *   DATABASE_URL    — Neon Postgres connection string (secret)
 *   JWT_SECRET      — HMAC signing secret for session JWTs (secret)
 *   ALLOWED_ORIGINS — Comma-separated list of allowed CORS origins
 *                     e.g. "https://zanflow.pages.dev,https://zanflow-dev.pages.dev"
 *                     In .dev.vars use: ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
 */

import { handleAuthRoutes }            from './routes/auth.js';
import { handleApplicantAuthRoutes }   from './routes/applicant-auth.js';
import { handleApplicationTypeRoutes } from './routes/application-types.js';
import { handleApplicationRoutes }     from './routes/applications.js';

/**
 * Parse allowed origins from the ALLOWED_ORIGINS env var.
 * Falls back to empty list if not set — CORS will be denied for all origins.
 */
function getAllowedOrigins(env) {
  const raw = env.ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin, env) {
  const allowed = getAllowedOrigins(env);
  if (!allowed.includes(origin)) return {};

  return {
    'Access-Control-Allow-Origin':      origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type, X-Tenant-Slug',
    'Access-Control-Max-Age':           '86400',
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const cors   = corsHeaders(origin, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      let response =
        (await handleAuthRoutes(request, env))            ??
        (await handleApplicantAuthRoutes(request, env))   ??
        (await handleApplicationTypeRoutes(request, env)) ??
        (await handleApplicationRoutes(request, env))     ??
        json({ error: 'Not found' }, 404);

      // Attach CORS headers to every response from an allowed origin
      if (Object.keys(cors).length > 0) {
        const headers = new Headers(response.headers);
        for (const [k, v] of Object.entries(cors)) {
          headers.set(k, v);
        }
        response = new Response(response.body, {
          status:  response.status,
          headers,
        });
      }

      return response;
    } catch (err) {
      console.error('[worker] Unhandled error:', err);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
  },
};
