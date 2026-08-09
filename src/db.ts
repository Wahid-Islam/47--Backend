import { neon } from '@neondatabase/serverless';

import { env } from './env';

/**
 * Neon HTTP query function.
 *
 * The driver talks to Neon over HTTP rather than holding a TCP connection,
 * which is what makes it usable from serverless functions: there is no
 * pool to warm up and nothing to close when the invocation ends.
 *
 * Created lazily so importing this module doesn't require DATABASE_URL --
 * unit tests can import the repositories without a database.
 */
let cached: ReturnType<typeof neon> | undefined;

function client(): ReturnType<typeof neon> {
  // Neon’s HTTP driver does not use PG channel binding; that query param
  // (common in dashboard copy-paste URLs) can break serverless connects.
  const url = env.databaseUrl
    .replace(/([?&])channel_binding=[^&]*&?/i, '$1')
    .replace(/[?&]$/, '');
  cached ??= neon(url);
  return cached;
}

/**
 * Runs a parameterised query and returns the rows.
 *
 * Always pass values as parameters:
 *
 *     sql`SELECT * FROM users WHERE email = ${email}`
 *
 * Never build SQL by concatenating strings. The tagged template turns
 * interpolations into `$1`, `$2`, ... placeholders, so user input can
 * never be parsed as SQL.
 */
export async function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const rows = await client()(strings, ...values);
  return rows as T[];
}

/** Returns the first row, or `null` when the query matched nothing. */
export async function sqlOne<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T | null> {
  const rows = await sql<T>(strings, ...values);
  return rows[0] ?? null;
}
