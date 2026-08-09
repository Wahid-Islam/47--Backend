import type { VercelRequest, VercelResponse } from '@vercel/node';

import demo from '../../src/routes/auth/demo';
import login from '../../src/routes/auth/login';
import me from '../../src/routes/auth/me';
import register from '../../src/routes/auth/register';

type Handler = (request: VercelRequest, response: VercelResponse) => Promise<void> | void;

const handlers: Record<string, Handler> = {
  demo,
  login,
  me,
  register,
};

/**
 * Single Hobby-plan function for /api/auth/:action
 * (register | login | demo | me).
 */
export default async function authAction(request: VercelRequest, response: VercelResponse): Promise<void> {
  const raw = request.query.action;
  const action = Array.isArray(raw) ? raw[0] : raw;
  const handler = action === undefined ? undefined : handlers[action];
  if (handler === undefined) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  await handler(request, response);
}
