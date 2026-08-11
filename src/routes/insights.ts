import { jsonBody, requireUser, withRoute } from '../http';
import { findInsights, upsertInsights } from '../repositories/insights';
import { parseInsightsPayload } from '../services/insightsPayload';
import { optionalString } from '../validation';

/** GET /api/insights -> { payload, generated_at } or null */
export default withRoute(['GET', 'PUT'], async (request) => {
  const { userId } = await requireUser(request);

  if (request.method === 'GET') {
    return findInsights(userId);
  }

  const body = jsonBody(request);
  const payload = parseInsightsPayload(body);
  const generatedAt = optionalString(body, 'generated_at') ?? new Date().toISOString();

  return upsertInsights(userId, payload, generatedAt);
});
