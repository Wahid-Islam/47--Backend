import type { VercelRequest, VercelResponse } from '@vercel/node';

import rf from '../../src/routes/recommendations/rf';

type Handler = (request: VercelRequest, response: VercelResponse) => Promise<void> | void;

const handlers: Record<string, Handler> = {
  rf,
  llm: rf, // legacy alias
};

/**
 * Single Hobby-plan function for /api/recommendations/:kind (rf | llm).
 */
export default async function recommendationsKind(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  const raw = request.query.kind;
  const kind = Array.isArray(raw) ? raw[0] : raw;
  const handler = kind === undefined ? undefined : handlers[kind];
  if (handler === undefined) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  await handler(request, response);
}
