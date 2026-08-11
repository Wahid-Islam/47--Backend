import { hashPassword } from '../../auth/password';
import { signSessionToken } from '../../auth/tokens';
import { conflict, jsonBody, withRoute } from '../../http';
import { assertRateLimit } from '../../rateLimit';
import { createUserWithProfile } from '../../repositories/users';
import { requireEmail, requirePassword, requireString } from '../../validation';

/** POST /api/auth/register */
export default withRoute(['POST'], async (request) => {
  assertRateLimit(request, 'auth-register', { limit: 10, windowMs: 60_000 });

  const body = jsonBody(request);
  const email = requireEmail(body);
  const password = requirePassword(body);
  const fullName = requireString(body, 'full_name', { max: 120 });

  const created = await createUserWithProfile(email, await hashPassword(password), fullName);
  if (created === null) {
    throw conflict('An account with that email already exists');
  }

  const token = await signSessionToken({ userId: created.user.id, email: created.user.email });

  return { token, user: created.user, profile: created.profile };
});
