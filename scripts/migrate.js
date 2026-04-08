import { neon } from '@neondatabase/serverless';
import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../migrations');

const PROJECT_ID = 'odd-silence-61915674';
const ORG_ID = 'org-restless-morning-32034443';

function getConnectionString() {
  try {
    return execSync(
      `neon connection-string --project-id ${PROJECT_ID} --org-id ${ORG_ID}`,
      { encoding: 'utf8' }
    ).trim();
  } catch (err) {
    console.error('Failed to get connection string from Neon CLI.');
    console.error('Run: neon auth');
    process.exit(1);
  }
}

const connectionString = getConnectionString();
const sql = neon(connectionString);

async function run() {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const applied = await sql`SELECT filename FROM _migrations`;
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

    const statements = readFileSync(join(migrationsDir, file), 'utf8')
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    console.log(`  apply ${file}`);
    for (const statement of statements) {
      await sql.unsafe(statement);
    }
    await sql`INSERT INTO _migrations (filename) VALUES (${file})`;
    ran++;
  }

  console.log(ran === 0 ? 'Nothing to migrate.' : `Done. ${ran} migration(s) applied.`);
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
