import { hashPassword, verifyPassword } from '../../src/auth/password.ts';
import { signSessionToken } from '../../src/auth/tokens.ts';
import { HttpError, withRoute } from '../../src/http.ts';
import { findProfile, upsertProfile } from '../../src/repositories/profiles.ts';
import { createUser, findUserByEmail } from '../../src/repositories/users.ts';

/**
 * POST /api/auth/demo
 *
 * Signs in to the shared demo account, creating it on first use, and seeds
 * the "Lim Wei Jian" profile so the app has something to show immediately.
 *
 * This is a **shared public account** -- anyone who clicks "Try the demo"
 * lands in the same row. It must never hold real personal data. That was
 * equally true of the Supabase implementation.
 *
 * Insights are not computed here. The risk engine lives in the Flutter app
 * so scoring stays in exactly one place; the client calls
 * `PUT /api/insights` after this returns. See docs/API.md.
 */

const DEMO_EMAIL = 'lim.weijian@healthpath.demo';
const DEMO_PASSWORD = 'demo1234';

const DEMO_PROFILE = {
  email: DEMO_EMAIL,
  fullName: 'Lim Wei Jian',
  age: 48,
  gender: 'male',
  state: 'Wilayah Persekutuan Kuala Lumpur',
  activityLevel: 'low',
  dietHabit: 'unhealthy',
  smoking: true,
  heightCm: 170,
  weightKg: 79.2,
  bmi: 27.4,
  alcohol: 'occasional',
  sleepHours: 5.5,
  highBloodPressure: true,
  onboardingComplete: true,
  locale: 'en',
  activeActionIds: ['bp_screening', 'walk_20', 'swap_drinks'],
} as const;

export default withRoute(['POST'], async () => {
  let user = await findUserByEmail(DEMO_EMAIL);

  if (user === null) {
    const created = await createUser(DEMO_EMAIL, await hashPassword(DEMO_PASSWORD));
    // A concurrent request may have created it between the lookup and the
    // insert; fall back to reading it rather than failing.
    const existing = created ?? (await findUserByEmail(DEMO_EMAIL));
    if (existing === null) throw new HttpError(500, 'Could not provision the demo account');
    user = { id: existing.id, email: existing.email, password_hash: '' };
  } else if (!(await verifyPassword(DEMO_PASSWORD, user.password_hash))) {
    // Someone changed the demo account's password, so this endpoint can no
    // longer vouch for it.
    throw new HttpError(409, 'The demo account password has been changed');
  }

  // Preserve a demo profile that has been customised through the
  // questionnaire, matching the previous Supabase behaviour.
  const existingProfile = await findProfile(user.id);
  const profile =
    existingProfile !== null && existingProfile.onboarding_complete
      ? existingProfile
      : await upsertProfile(user.id, { ...DEMO_PROFILE, activeActionIds: [...DEMO_PROFILE.activeActionIds] });

  const token = await signSessionToken({ userId: user.id, email: user.email });

  return { token, user: { id: user.id, email: user.email }, profile };
});
