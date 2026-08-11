import { randomUUID } from 'node:crypto';

import { hashPassword } from '../../auth/password';
import { signSessionToken } from '../../auth/tokens';
import { HttpError, withRoute } from '../../http';
import { assertRateLimit } from '../../rateLimit';
import { resetHabitLog } from '../../repositories/habits';
import { upsertInsights } from '../../repositories/insights';
import { upsertProfile } from '../../repositories/profiles';
import { createUserWithProfile } from '../../repositories/users';
import { todayInAppTz } from '../../time';

/**
 * POST /api/auth/demo
 * Creates a fresh temporary demo user per call so concurrent visitors do not share state.
 */

const DEMO_PROFILE_BASE = {
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

const DEMO_INSIGHTS = {
  actualAge: 48,
  healthAge: 55,
  healthAgeDelta: 7,
  disclaimer: 'Demo insights for MySihat walkthrough only.',
  overallRiskLevel: 'elevated',
  overallRiskScore: 0.62,
};

export default withRoute(['POST'], async (request) => {
  assertRateLimit(request, 'auth-demo', { limit: 20, windowMs: 60_000 });

  const sessionId = randomUUID().replace(/-/g, '').slice(0, 12);
  const email = `demo.${sessionId}@mysihat.demo`;
  const passwordHash = await hashPassword(randomUUID());

  const created = await createUserWithProfile(email, passwordHash, DEMO_PROFILE_BASE.fullName);
  if (created === null) {
    throw new HttpError(500, 'Could not provision a demo session');
  }

  const profile = await upsertProfile(created.user.id, {
    ...DEMO_PROFILE_BASE,
    email,
    activeActionIds: [...DEMO_PROFILE_BASE.activeActionIds],
  });

  const today = todayInAppTz();
  await resetHabitLog(created.user.id, today);
  await upsertInsights(created.user.id, { ...DEMO_INSIGHTS }, new Date().toISOString());

  const token = await signSessionToken({ userId: created.user.id, email: created.user.email });

  return {
    token,
    user: { id: created.user.id, email: created.user.email },
    profile,
    demo: true,
  };
});
