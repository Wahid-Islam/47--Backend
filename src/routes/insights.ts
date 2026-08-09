import { jsonBody, requireUser, withRoute } from '../http';
import { findInsights, upsertInsights } from '../repositories/insights';
import { optionalString, requireObject } from '../validation';

/**
 * GET /api/insights -> { payload, generated_at } or null
 * PUT /api/insights -> body { payload, generated_at? }
 *
 * The API stores the risk engine's output but never computes it: scoring
 * runs on-device in Dart so there is a single implementation. `payload` is
 * therefore accepted as an opaque object and only checked for being an
 * object, not for its internal shape -- the Flutter model owns that
 * contract, and validating it in two places would guarantee they drift.
 */
export default withRoute(['GET', 'PUT'], async (request) => {
  const { userId } = await requireUser(request);

  if (request.method === 'GET') {
    return findInsights(userId);
  }

  const body = jsonBody(request);
  const payload = requireObject(body, 'payload');
  const generatedAt = optionalString(body, 'generated_at') ?? new Date().toISOString();

  return upsertInsights(userId, payload, generatedAt);
});
