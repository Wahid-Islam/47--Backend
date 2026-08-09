import type { VercelRequest, VercelResponse } from '@vercel/node';

import demo from './routes/auth/demo';
import login from './routes/auth/login';
import me from './routes/auth/me';
import register from './routes/auth/register';
import clinics from './routes/clinics';
import history from './routes/habits/history';
import today from './routes/habits/today';
import insights from './routes/insights';
import mortalityBaselines from './routes/mortality-baselines';
import profile from './routes/profile';
import questionnaire from './routes/questionnaire';
import rf from './routes/recommendations/rf';

type Handler = (request: VercelRequest, response: VercelResponse) => Promise<void> | void;

async function health(_request: VercelRequest, response: VercelResponse): Promise<void> {
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

const routes: Record<string, Handler> = {
  '/api/health': health,
  '/api/auth/register': register,
  '/api/auth/login': login,
  '/api/auth/demo': demo,
  '/api/auth/me': me,
  '/api/profile': profile,
  '/api/insights': insights,
  '/api/habits/today': today,
  '/api/habits/history': history,
  '/api/recommendations/rf': rf,
  '/api/recommendations/llm': rf,
  '/api/questionnaire': questionnaire,
  '/api/clinics': clinics,
  '/api/mortality-baselines': mortalityBaselines,
};

function pathnameOf(request: VercelRequest): string {
  const rawPath = request.query.path;
  if (typeof rawPath === 'string' && rawPath.length > 0) {
    return `/api/${rawPath.replace(/^\/+/, '')}`;
  }
  if (Array.isArray(rawPath) && rawPath.length > 0) {
    return `/api/${rawPath.join('/')}`;
  }

  const url = request.url ?? '/';
  const pathOnly = url.split('?')[0] ?? '/';
  if (pathOnly === '/api' || pathOnly === '/api/') return '/api/health';
  return pathOnly;
}

/** Single Hobby-safe Vercel entry. Built to api/[...path].js via esbuild. */
export default async function vercelEntry(request: VercelRequest, response: VercelResponse): Promise<void> {
  const pathname = pathnameOf(request);
  const handler = routes[pathname];
  if (handler === undefined) {
    response.status(404).json({ error: `No route for ${pathname}` });
    return;
  }
  await handler(request, response);
}
