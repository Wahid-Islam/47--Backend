import { jsonBody, requireUser, withRoute } from '../http';
import { findInsights, upsertInsights } from '../repositories/insights';
import { parseInsightsPayload } from '../services/insightsPayload';

/** GET /api/insights -> { payload, generated_at } or null */
export default withRoute(['GET', 'PUT'], async (request) => {
  const { userId } = await requireUser(request);

  if (request.method === 'GET') {
    return findInsights(userId);
  }

  const body = jsonBody(request);
  const payload = parseInsightsPayload(body);
  // Always server-stamped so malformed client timestamps cannot 500 Postgres.
  const generatedAt = new Date().toISOString();

  return upsertInsights(userId, payload, generatedAt);
});
