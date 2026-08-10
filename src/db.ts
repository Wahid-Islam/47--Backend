import { neon } from '@neondatabase/serverless';

import { env } from './env';

let cached: ReturnType<typeof neon> | undefined;

function client(): ReturnType<typeof neon> {
  const url = env.databaseUrl
    .replace(/([?&])channel_binding=[^&]*&?/i, '$1')
    .replace(/[?&]$/, '');
  cached ??= neon(url);
  return cached;
}

export async function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const rows = await client()(strings, ...values);
  return rows as T[];
}

export async function sqlOne<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T | null> {
  const rows = await sql<T>(strings, ...values);
  return rows[0] ?? null;
}
