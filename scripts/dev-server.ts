/**
 * Local HTTP server that runs the same handlers as Vercel, without needing
 * `vercel login`. Used by `npm run dev`.
 *
 *   npm run dev          -> http://localhost:3000
 *   PORT=4000 npm run dev
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';

import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (request: VercelRequest, response: VercelResponse) => Promise<void> | void;

async function loadHandlers(): Promise<Map<string, Handler>> {
  const modules: Array<[string, string]> = [
    ['/api/health', '../api/health.js'],
    ['/api/auth/register', '../src/routes/auth/register.ts'],
    ['/api/auth/login', '../src/routes/auth/login.ts'],
    ['/api/auth/demo', '../src/routes/auth/demo.ts'],
    ['/api/auth/me', '../src/routes/auth/me.ts'],
    ['/api/profile', '../api/profile.ts'],
    ['/api/insights', '../api/insights.ts'],
    ['/api/habits/today', '../src/routes/habits/today.ts'],
    ['/api/habits/history', '../src/routes/habits/history.ts'],
    ['/api/recommendations/llm', '../src/routes/recommendations/rf.ts'],
    ['/api/recommendations/rf', '../src/routes/recommendations/rf.ts'],
    ['/api/questionnaire', '../api/questionnaire.ts'],
    ['/api/clinics', '../api/clinics.ts'],
    ['/api/mortality-baselines', '../api/mortality-baselines.ts'],
  ];

  const map = new Map<string, Handler>();
  for (const [path, file] of modules) {
    const mod = (await import(file)) as { default: Handler };
    map.set(path, mod.default);
  }
  return map;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw === '') return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function wrapResponse(res: ServerResponse): VercelResponse {
  const response = res as ServerResponse & VercelResponse;

  response.status = ((code: number) => {
    res.statusCode = code;
    return response;
  }) as VercelResponse['status'];

  response.json = ((body: unknown) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(body));
    return response;
  }) as VercelResponse['json'];

  response.send = ((body: unknown) => {
    if (typeof body === 'object' && body !== null) {
      return response.json(body);
    }
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
    res.end(body === undefined || body === null ? '' : String(body));
    return response;
  }) as VercelResponse['send'];

  return response;
}

async function wrapRequest(req: IncomingMessage, url: URL): Promise<VercelRequest> {
  const body = await readBody(req);
  const query: Record<string, string | string[]> = {};
  for (const key of url.searchParams.keys()) {
    const values = url.searchParams.getAll(key);
    query[key] = values.length === 1 ? (values[0] as string) : values;
  }

  const request = req as IncomingMessage & VercelRequest;
  request.body = body;
  request.query = query;
  request.cookies = {};
  return request;
}

const port = Number(process.env.PORT ?? 3000);
const handlers = await loadHandlers();

const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host ?? `localhost:${port}`;
    const url = new URL(req.url ?? '/', `http://${host}`);
    const handler = handlers.get(url.pathname);

    if (handler === undefined) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: `No route for ${url.pathname}` }));
      return;
    }

    const request = await wrapRequest(req, url);
    const response = wrapResponse(res);
    await handler(request, response);

    if (!res.writableEnded) {
      res.statusCode = res.statusCode || 204;
      res.end();
    }
  } catch (error) {
    console.error('Unhandled server error:', error);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
});

server.listen(port, () => {
  console.log(`mysihat API listening on http://localhost:${port}`);
  console.log(`health check:     http://localhost:${port}/api/health`);
});
