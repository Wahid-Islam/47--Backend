import { verifyPassword } from '../../auth/password.ts';
import { signSessionToken } from '../../auth/tokens.ts';
import { HttpError, jsonBody, withRoute } from '../../http.ts';
import { createProfile, findProfile } from '../../repositories/profiles.ts';
import { findUserByEmail } from '../../repositories/users.ts';
import { requireEmail, requirePassword } from '../../validation.ts';

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
