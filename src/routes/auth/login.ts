import { verifyPassword } from '../../auth/password';
import { signSessionToken } from '../../auth/tokens';
import { HttpError, jsonBody, withRoute } from '../../http';
import { assertRateLimit } from '../../rateLimit';
import { createProfile, findProfile } from '../../repositories/profiles';
import { findUserByEmail } from '../../repositories/users';
import { requireEmail, requirePassword } from '../../validation';

/** POST /api/auth/login */
export default withRoute(['POST'], async (request) => {
  assertRateLimit(request, 'auth-login', { limit: 30, windowMs: 60_000 });

  const body = jsonBody(request);
  const email = requireEmail(body);
  const password = requirePassword(body);

  const user = await findUserByEmail(email);

  // Same error for unknown user and wrong password.
  const invalid = new HttpError(401, 'Incorrect email or password');
  if (user === null) throw invalid;
  if (!(await verifyPassword(password, user.password_hash))) throw invalid;

  const profile = (await findProfile(user.id)) ?? (await createProfile(user.id, user.email, ''));
  const token = await signSessionToken({ userId: user.id, email: user.email });

  return { token, user: { id: user.id, email: user.email }, profile };
});
