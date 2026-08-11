import { jsonBody, requireUser, withRoute } from '../http';
import { parseProfileInput } from '../profileInput';
import { findProfile, upsertProfile } from '../repositories/profiles';

/** GET  /api/profile  -> the caller's profile, or null if they have none yet */
export default withRoute(['GET', 'PUT'], async (request) => {
  const { userId, email } = await requireUser(request);

  if (request.method === 'GET') {
    return findProfile(userId);
  }

  const existing = await findProfile(userId);
  const input = parseProfileInput(jsonBody(request), email, {
    existingActionIds: existing?.active_action_ids ?? [],
  });
  return upsertProfile(userId, input);
});
