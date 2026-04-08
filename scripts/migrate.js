import { neon } from '@neondatabase/serverless';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../migrations');

const DATABASE_URL = process.env.NEON_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: NEON_DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  // Create migrations tracking table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Get already-applied migrations
  const applied = await sql`SELECT filename FROM _migrations`;
  const appliedSet = new Set(applied.map((r) => r.filename));

  // Get all .sql files in order
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip  ${file}`);
      continue;
    }

    const filePath = join(migrationsDir, file);
    const sql_text = readFileSync(filePath, 'utf8');

    console.log(`  apply ${file}`);
    await sql.transaction((tx) => [
      tx(sql_text),
      tx`INSERT INTO _migrations (filename) VALUES (${file})`,
    ]);
    ran++;
  }

  if (ran === 0) {
    console.log('Nothing to migrate.');
  } else {
    console.log(`Done. ${ran} migration(s) applied.`);
  }
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
