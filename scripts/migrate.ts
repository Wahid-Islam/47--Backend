/**
 * Applies every SQL file in migrations/ that hasn't run yet.
 *
 *   npm run migrate
 *
 * Uses `pg` over a direct TCP connection rather than the Neon HTTP driver
 * the API uses. Two reasons: the HTTP driver sends one statement per
 * request, while these files contain many (plus dollar-quoted function
 * bodies), and migrations need a real transaction so a failure part-way
 * through leaves nothing half-applied.
 *
 * Prefers DATABASE_URL_UNPOOLED, because DDL wants one stable session
 * rather than PgBouncer handing out a different one per statement.
 *
 * Applied filenames are recorded in `schema_migrations`, so re-running is a
 * no-op.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

function connectionString(): string {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (url === undefined || url.trim() === '') {
    console.error(
      'DATABASE_URL is not set.\n\n' +
        'Pull your Neon credentials from Vercel first:\n' +
        '  vercel env pull .env.development.local\n\n' +
        'Then run:\n' +
        '  npm run migrate\n',
    );
    process.exit(1);
  }
  return url;
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ filename: string }>('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.filename));

    const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip   ${file}`);
        continue;
      }

      const statements = await readFile(join(migrationsDir, file), 'utf8');
      process.stdout.write(`  apply  ${file} ... `);

      try {
        await client.query('BEGIN');
        await client.query(statements);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log('done');
        ran += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        console.log('FAILED (rolled back)');
        console.error(error);
        process.exitCode = 1;
        return;
      }
    }

    console.log(ran === 0 ? '\nDatabase already up to date.' : `\nApplied ${ran} migration(s).`);
  } finally {
    await client.end();
  }
}

await main();
