import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const sql = neon(url);
const rows = await sql`
  SELECT
    now() AS now,
    (SELECT count(*)::int FROM clinics) AS clinics,
    (SELECT count(*)::int FROM national_mortality_baselines) AS baselines,
    (SELECT count(*)::int FROM schema_migrations) AS migrations
`;
console.log(JSON.stringify(rows[0], null, 2));
