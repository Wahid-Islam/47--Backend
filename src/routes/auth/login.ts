import { verifyPassword } from '../../auth/password';
import { signSessionToken } from '../../auth/tokens';
import { HttpError, jsonBody, withRoute } from '../../http';
import { createProfile, findProfile } from '../../repositories/profiles';
import { findUserByEmail } from '../../repositories/users';
import { requireEmail, requirePassword } from '../../validation';

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export default withRoute(['POST'], async (request) => {
  const body = jsonBody(request);
  const email = requireEmail(body);
  const password = requirePassword(body);

  const user = await findUserByEmail(email);

  // One message and one code for both "no such user" and "wrong password".
  // Distinguishing them turns the login form into an account enumerator.
  const invalid = new HttpError(401, 'Incorrect email or password');
  if (user === null) throw invalid;
  if (!(await verifyPassword(password, user.password_hash))) throw invalid;

  // A profile row should always exist, but a failed registration could have
  // left a user without one; recreate it rather than 500-ing on login.
  const profile = (await findProfile(user.id)) ?? (await createProfile(user.id, user.email, ''));
  const token = await signSessionToken({ userId: user.id, email: user.email });

  return { token, user: { id: user.id, email: user.email }, profile };
});
