import { hashPassword, verifyPassword } from '../../auth/password';
import { signSessionToken } from '../../auth/tokens';
import { HttpError, withRoute } from '../../http';
import { findProfile, upsertProfile } from '../../repositories/profiles';
import { createUser, findUserByEmail } from '../../repositories/users';

/** POST /api/auth/demo */

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
  diabetes: false,
  onboardingComplete: true,
  locale: 'en',
  activeActionIds: ['bp_screening', 'walk_20', 'swap_drinks'],
} as const;

export default withRoute(['POST'], async () => {
  let user = await findUserByEmail(DEMO_EMAIL);

  if (user === null) {
    const created = await createUser(DEMO_EMAIL, await hashPassword(DEMO_PASSWORD));
    const existing = created ?? (await findUserByEmail(DEMO_EMAIL));
    if (existing === null) throw new HttpError(500, 'Could not provision the demo account');
    user = { id: existing.id, email: existing.email, password_hash: '' };
  } else if (!(await verifyPassword(DEMO_PASSWORD, user.password_hash))) {
    throw new HttpError(409, 'The demo account password has been changed');
  }

  const existingProfile = await findProfile(user.id);
  const profile =
    existingProfile !== null && existingProfile.onboarding_complete
      ? existingProfile
      : await upsertProfile(user.id, { ...DEMO_PROFILE, activeActionIds: [...DEMO_PROFILE.activeActionIds] });

  const token = await signSessionToken({ userId: user.id, email: user.email });

  return { token, user: { id: user.id, email: user.email }, profile };
});
