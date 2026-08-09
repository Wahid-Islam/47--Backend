import { hashPassword } from '../../auth/password.ts';
import { signSessionToken } from '../../auth/tokens.ts';
import { conflict, jsonBody, withRoute } from '../../http.ts';
import { createProfile } from '../../repositories/profiles.ts';
import { createUser } from '../../repositories/users.ts';
import { requireEmail, requirePassword, requireString } from '../../validation.ts';

/**
 * POST /api/auth/register
 * Body: { email, password, full_name }
 *
 * Creates the user and their profile row, then returns a session token so
 * the client doesn't have to log in as a second step.
 */
export default withRoute(['POST'], async (request) => {
  const body = jsonBody(request);
  const email = requireEmail(body);
  const password = requirePassword(body);
  const fullName = requireString(body, 'full_name', { max: 120 });

  const user = await createUser(email, await hashPassword(password));
  if (user === null) {
    // The email is taken. This does reveal that an account exists, which is
    // unavoidable for a registration form that has to explain the failure.
    throw conflict('An account with that email already exists');
  }

  const profile = await createProfile(user.id, email, fullName);
  const token = await signSessionToken({ userId: user.id, email: user.email });

  return { token, user, profile };
});
