const PLATFORM_HOST = 'platform.zanflo.com';
const APEX_HOSTS = new Set(['zanflo.com', 'www.zanflo.com']);

function normaliseHost(host) {
  return (host ?? '').toLowerCase().trim();
}

export function getRequestHost(request) {
  return normaliseHost(request.headers.get('host'));
}

export function isPlatformHost(request) {
  return getRequestHost(request) === PLATFORM_HOST;
}

export function isApexHost(request) {
  return APEX_HOSTS.has(getRequestHost(request));
}

export function isTenantHost(request) {
  const host = getRequestHost(request);
  return host.endsWith('.zanflo.com') && !isPlatformHost(request) && !isApexHost(request);
}

export function allowTenantSlugFallback(request, env) {
  const host = getRequestHost(request);
  const appEnv = (env.APP_ENV ?? env.NODE_ENV ?? '').toLowerCase().trim();

  if (appEnv === 'production' || appEnv === 'prod' || appEnv === 'live') {
    return false;
  }

  if (appEnv === 'test' || appEnv === 'development' || appEnv === 'dev' || appEnv === 'local') {
    return true;
  }

  if (!host) return true;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host.endsWith('.workers.dev')) return true;
  if (host.endsWith('.example.test') || host === 'example.test') return true;

  return false;
}
