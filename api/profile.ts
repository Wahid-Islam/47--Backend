import { jsonBody, requireUser, withRoute } from '../src/http.ts';
import { parseProfileInput } from '../src/profileInput.ts';
import { findProfile, upsertProfile } from '../src/repositories/profiles.ts';

/**
 * GET  /api/profile  -> the caller's profile, or null if they have none yet
 * PUT  /api/profile  -> replaces the caller's profile
 *
 * Both are scoped by the user id in the verified token. There is no
 * `/api/profile/:id`, by design: no endpoint should be able to address
 * another user's profile at all.
 */
export default withRoute(['GET', 'PUT'], async (request) => {
  const { userId, email } = await requireUser(request);

  if (request.method === 'GET') {
    return findProfile(userId);
  }

  const input = parseProfileInput(jsonBody(request), email);
  return upsertProfile(userId, input);
});
