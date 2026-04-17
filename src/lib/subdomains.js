/**
 * Shared subdomain validation rules.
 *
 * Reserved names must stay consistent between:
 * - request-time tenant resolution
 * - platform admin tenant creation
 * - public onboarding request intake
 */

export const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'admin', 'platform', 'app', 'mail', 'smtp',
  'assets', 'static', 'cdn', 'status', 'login', 'auth',
  'billing', 'staging', 'dev', 'test', 'sandbox', 'demo',
  'support', 'root',
]);

export const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;

export function validateSubdomain(subdomain) {
  if (!subdomain) return 'requested subdomain is required';
  if (!SUBDOMAIN_RE.test(subdomain)) {
    return 'requested subdomain must be 2-63 lowercase alphanumeric characters or hyphens';
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return `'${subdomain}' is a reserved subdomain`;
  }
  return null;
}
