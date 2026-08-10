import { badRequest } from './http';
import type { ProfileInput } from './repositories/profiles';
import {
  optionalString,
  requireBoolean,
  requireEnum,
  requireInt,
  requireNumber,
  requireString,
  requireStringArray,
} from './validation';

export const GENDERS = ['male', 'female', 'other'] as const;
export const ACTIVITY_LEVELS = ['low', 'moderate', 'high'] as const;
export const DIET_HABITS = ['unhealthy', 'average', 'healthy'] as const;
export const ALCOHOL_LEVELS = ['none', 'occasional', 'regular'] as const;
export const LOCALES = ['en', 'bm'] as const;

export function parseProfileInput(body: Record<string, unknown>, email: string | null): ProfileInput {
  const heightCm = requireNumber(body, 'height_cm', { min: 100, max: 250 });
  const weightKg = requireNumber(body, 'weight_kg', { min: 30, max: 250 });
  const metres = heightCm / 100;
  const derivedBmi = Math.round((weightKg / (metres * metres)) * 10) / 10;

  const rawBmi = body.bmi;
  const parsedBmi =
    typeof rawBmi === 'number' && Number.isFinite(rawBmi)
      ? rawBmi
      : typeof rawBmi === 'string'
        ? Number(rawBmi)
        : Number.NaN;
  const bmi =
    Number.isFinite(parsedBmi) && parsedBmi >= 10 && parsedBmi <= 60 ? parsedBmi : derivedBmi;

  if (bmi < 10 || bmi > 60) {
    throw badRequest('"height_cm" and "weight_kg" produce a BMI outside 10–60');
  }

  return {
    email: optionalString(body, 'email') ?? email,
    fullName: requireString(body, 'full_name', { max: 120 }),
    age: requireInt(body, 'age', { min: 18, max: 90 }),
    gender: requireEnum(body, 'gender', GENDERS),
    state: optionalString(body, 'state') || 'Wilayah Persekutuan Kuala Lumpur',
    activityLevel: requireEnum(body, 'activity_level', ACTIVITY_LEVELS),
    dietHabit: requireEnum(body, 'diet_habit', DIET_HABITS),
    smoking: requireBoolean(body, 'smoking'),
    heightCm,
    weightKg,
    bmi,
    alcohol: requireEnum(body, 'alcohol', ALCOHOL_LEVELS),
    sleepHours: requireNumber(body, 'sleep_hours', { min: 3, max: 14 }),
    highBloodPressure:
      body.high_blood_pressure === undefined ? false : requireBoolean(body, 'high_blood_pressure'),
    onboardingComplete: requireBoolean(body, 'onboarding_complete'),
    locale: requireEnum(body, 'locale', LOCALES),
    activeActionIds: requireStringArray(body, 'active_action_ids'),
  };
}
