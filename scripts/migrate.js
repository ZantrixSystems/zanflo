// Migration runner — reads from .dev.vars, connects to Neon, applies pending SQL files.
// Run: npm run migrate

import { Pool } from '@neondatabase/serverless';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../migrations');

function loadDevVars() {
  const devVarsPath = join(__dirname, '../.dev.vars');
  try {
    const contents = readFileSync(devVarsPath, 'utf8');
    for (const line of contents.split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
  } catch {
    console.error('ERROR: .dev.vars not found. Create it with DATABASE_URL=...');
    process.exit(1);
  }
}

loadDevVars();

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes('PASTE_YOUR')) {
  console.error('ERROR: DATABASE_URL not set in .dev.vars');
  process.exit(1);
}

async function run() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: applied } = await client.query('SELECT filename FROM _migrations');
    const appliedSet = new Set(applied.map((r) => r.filename));

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      console.log(`  apply ${file}`);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      ran++;
    }

    console.log(ran === 0 ? 'Nothing to migrate.' : `Done. ${ran} migration(s) applied.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
