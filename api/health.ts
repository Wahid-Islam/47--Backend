import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/health
 *
 * Kept dependency-light so a bad import graph cannot take down the
 * liveness probe. Database check is best-effort.
 */
export default async function health(request: VercelRequest, response: VercelResponse): Promise<void> {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const payload: Record<string, unknown> = {
    status: 'ok',
    database: 'skipped',
    time: null,
  };

  const databaseUrl = process.env.DATABASE_URL;
  if (typeof databaseUrl === 'string' && databaseUrl.trim() !== '') {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const url = databaseUrl
        .replace(/([?&])channel_binding=[^&]*&?/i, '$1')
        .replace(/[?&]$/, '');
      const sql = neon(url);
      const rows = (await sql`SELECT now() AS now`) as Array<{ now: string }>;
      payload.database = 'ok';
      payload.time = rows[0]?.now ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'database error';
      console.error('health database check failed:', message);
      payload.status = 'degraded';
      payload.database = 'unreachable';
      payload.error = 'database query failed';
    }
  } else {
    payload.status = 'degraded';
    payload.database = 'unreachable';
    payload.error = 'DATABASE_URL missing';
  }

  response.status(200).json(payload);
}
