import { neon } from '@neondatabase/serverless';

/**
 * Returns a Neon SQL client bound to the DATABASE_URL environment variable.
 * Call once per request — Workers are stateless.
 */
export function getDb(env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  return neon(env.DATABASE_URL);
}
