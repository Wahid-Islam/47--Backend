import { hashPassword } from '../../auth/password';
import { signSessionToken } from '../../auth/tokens';
import { conflict, jsonBody, withRoute } from '../../http';
import { createProfile } from '../../repositories/profiles';
import { createUser } from '../../repositories/users';
import { requireEmail, requirePassword, requireString } from '../../validation';

/** POST /api/auth/register */
export default withRoute(['POST'], async (request) => {
  const body = jsonBody(request);
  const email = requireEmail(body);
  const password = requirePassword(body);
  const fullName = requireString(body, 'full_name', { max: 120 });

  const user = await createUser(email, await hashPassword(password));
  if (user === null) {
    throw conflict('An account with that email already exists');
  }

  const profile = await createProfile(user.id, email, fullName);
  const token = await signSessionToken({ userId: user.id, email: user.email });

  return { token, user, profile };
});
