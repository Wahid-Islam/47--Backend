import type { ProfileInput } from './repositories/profiles.ts';
import {
  optionalString,
  requireBoolean,
  requireEnum,
  requireInt,
  requireNumber,
  requireString,
  requireStringArray,
} from './validation.ts';

export const GENDERS = ['male', 'female', 'other'] as const;
export const ACTIVITY_LEVELS = ['low', 'moderate', 'high'] as const;
export const DIET_HABITS = ['unhealthy', 'average', 'healthy'] as const;
export const LOCALES = ['en', 'bm'] as const;

/**
 * Validates a profile payload from the questionnaire.
 *
 * The bounds match the Flutter form validators *and* the Postgres CHECK
 * constraints, so a value that gets past the browser is still rejected here
 * with a readable message rather than as a constraint violation.
 *
 * Note that `id` is ignored if present -- the row written is always the
 * caller's own, keyed by the id in their token.
 */
export function parseProfileInput(body: Record<string, unknown>, email: string | null): ProfileInput {
  return {
    email: optionalString(body, 'email') ?? email,
    fullName: requireString(body, 'full_name', { max: 120 }),
    age: requireInt(body, 'age', { min: 18, max: 90 }),
    gender: requireEnum(body, 'gender', GENDERS),
    state: requireString(body, 'state', { max: 120 }),
    activityLevel: requireEnum(body, 'activity_level', ACTIVITY_LEVELS),
    dietHabit: requireEnum(body, 'diet_habit', DIET_HABITS),
    smoking: requireBoolean(body, 'smoking'),
    bmi: requireNumber(body, 'bmi', { min: 10, max: 60 }),
    highBloodPressure: requireBoolean(body, 'high_blood_pressure'),
    onboardingComplete: requireBoolean(body, 'onboarding_complete'),
    locale: requireEnum(body, 'locale', LOCALES),
    activeActionIds: requireStringArray(body, 'active_action_ids'),
  };
}
