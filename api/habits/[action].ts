import type { VercelRequest, VercelResponse } from '@vercel/node';

import history from '../../src/routes/habits/history.ts';
import today from '../../src/routes/habits/today.ts';

type Handler = (request: VercelRequest, response: VercelResponse) => Promise<void> | void;

const handlers: Record<string, Handler> = {
  history,
  today,
};

/**
 * Single Hobby-plan function for /api/habits/:action (today | history).
 */
export default async function habitsAction(request: VercelRequest, response: VercelResponse): Promise<void> {
  const raw = request.query.action;
  const action = Array.isArray(raw) ? raw[0] : raw;
  const handler = action === undefined ? undefined : handlers[action];
  if (handler === undefined) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  await handler(request, response);
}
