import { notFound, requireUser, withRoute } from '../../src/http.ts';
import { findProfile } from '../../src/repositories/profiles.ts';
import { findUserById } from '../../src/repositories/users.ts';

/**
 * GET /api/auth/me
 *
 * Resolves the bearer token to the current user and profile. The Flutter app
 * calls this on start-up to restore a session, replacing Supabase's
 * `currentUser` plus `onAuthStateChange`.
 */
export default withRoute(['GET'], async (request) => {
  const { userId } = await requireUser(request);

  const user = await findUserById(userId);
  // The token is valid but the account is gone -- e.g. deleted while a
  // session was still live.
  if (user === null) throw notFound('User no longer exists');

  return { user, profile: await findProfile(userId) };
});
