import { neon } from '@neondatabase/serverless';

const migrations = [
  {
    filename: '0001_create_applications.sql',
    statements: [
      `CREATE TABLE applications (
        id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id            UUID        NOT NULL,
        applicant_name       TEXT,
        applicant_email      TEXT,
        applicant_phone      TEXT,
        premises_name        TEXT,
        premises_address     TEXT,
        premises_description TEXT,
        status               TEXT        NOT NULL DEFAULT 'draft'
                                         CONSTRAINT applications_status_check
                                         CHECK (status IN ('draft', 'submitted')),
        submitted_at         TIMESTAMPTZ,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT submitted_at_only_when_submitted
          CHECK (
            (status = 'submitted' AND submitted_at IS NOT NULL)
            OR
            (status = 'draft'     AND submitted_at IS NULL)
          )
      )`,
      `CREATE INDEX idx_applications_tenant_id     ON applications (tenant_id)`,
      `CREATE INDEX idx_applications_tenant_status ON applications (tenant_id, status)`,
    ],
  },
];

export async function runMigrations(env) {
  const sql = neon(env.NEON_DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const applied = await sql`SELECT filename FROM _migrations`;
  const appliedSet = new Set(applied.map((r) => r.filename));

  const results = [];

  for (const migration of migrations) {
    if (appliedSet.has(migration.filename)) {
      results.push({ file: migration.filename, status: 'skipped' });
      continue;
    }

    for (const statement of migration.statements) {
      await sql.unsafe(statement);
    }
    await sql`INSERT INTO _migrations (filename) VALUES (${migration.filename})`;

    results.push({ file: migration.filename, status: 'applied' });
  }

  return { migrations: results };
}
