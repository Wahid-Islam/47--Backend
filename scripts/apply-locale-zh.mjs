import { readFileSync } from 'fs';
import pg from 'pg';

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i <= 0) continue;
      const key = trimmed.slice(0, i).trim();
      let value = trimmed.slice(i + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // ignore missing file
  }
}

loadEnv('.env');

const raw = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '';
const url = raw.replace(/([?&])channel_binding=[^&]*&?/i, '$1').replace(/[?&]$/, '');
if (!url) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const sql = readFileSync('migrations/005_locale_zh.sql', 'utf8');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(sql);
const r = await client.query(
  "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'profiles_locale_valid'",
);
console.log(r.rows[0] ?? 'constraint missing');
await client.end();
