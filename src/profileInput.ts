import { parseOptionalActionIds } from './catalog/ids';
import { badRequest } from './http';
import type { ProfileInput } from './repositories/profiles';
import {
  optionalString,
  requireBoolean,
  requireEnum,
  requireInt,
  requireNumber,
  requireString,
} from './validation';

export const GENDERS = ['male', 'female', 'other'] as const;
export const ACTIVITY_LEVELS = ['low', 'moderate', 'high'] as const;
export const DIET_HABITS = ['unhealthy', 'average', 'healthy'] as const;
export const ALCOHOL_LEVELS = ['none', 'occasional', 'regular'] as const;
export const LOCALES = ['en', 'bm', 'zh'] as const;

export interface ParseProfileOptions {
  /** Used when active_action_ids is omitted from the body. */
  existingActionIds?: string[];
}

export function parseProfileInput(
  body: Record<string, unknown>,
  /** Authenticated account email; body email is ignored. */
  email: string | null,
  options: ParseProfileOptions = {},
): ProfileInput {
  const heightCm = requireNumber(body, 'height_cm', { min: 120, max: 220 });
  const weightKg = requireNumber(body, 'weight_kg', { min: 35, max: 200 });
  const metres = heightCm / 100;
  const bmi = Math.round((weightKg / (metres * metres)) * 10) / 10;

  if (bmi < 10 || bmi > 60) {
    throw badRequest(
      'Height and weight produce an unrealistic BMI (must be between 10 and 60).',
    );
  }

  if (body.high_blood_pressure === undefined) {
    throw badRequest('"high_blood_pressure" is required');
  }
  if (body.diabetes === undefined) {
    throw badRequest('"diabetes" is required');
  }

  const parsedActions = parseOptionalActionIds(body.active_action_ids);
  const activeActionIds = parsedActions ?? options.existingActionIds ?? [];

  return {
    email,
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
    highBloodPressure: requireBoolean(body, 'high_blood_pressure'),
    diabetes: requireBoolean(body, 'diabetes'),
    onboardingComplete: requireBoolean(body, 'onboarding_complete'),
    locale: requireEnum(body, 'locale', LOCALES),
    activeActionIds,
  };
}
