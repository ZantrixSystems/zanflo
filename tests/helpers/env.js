import { readFileSync } from 'fs';
import { join } from 'path';

export function loadTestEnv(overrides = {}) {
  const env = {};
  const devVarsPath = join(process.cwd(), '.dev.vars');
  const contents = readFileSync(devVarsPath, 'utf8');

  for (const line of contents.split(/\r?\n/)) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) env[key.trim()] = rest.join('=').trim();
  }

  env.ASSETS = {
    fetch: async () => new Response('asset', { status: 200 }),
  };

  env.APP_ENV = 'test';

  Object.assign(env, overrides);

  return env;
}
