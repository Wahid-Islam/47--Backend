import { notFound, requireUser, withRoute } from '../../http';
import { findProfile } from '../../repositories/profiles';
import { findUserById } from '../../repositories/users';

/** GET /api/auth/me */
export default withRoute(['GET'], async (request) => {
  const { userId } = await requireUser(request);

  const user = await findUserById(userId);
  if (user === null) throw notFound('User no longer exists');

  return { user, profile: await findProfile(userId) };
});
