import { parseProfileInput } from '../profileInput';
import type { ProfileInput, ProfileRow } from '../repositories/profiles';
import { findProfile, upsertProfile } from '../repositories/profiles';

function pick(
  answers: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (answers[key] !== undefined) return answers[key];
  }
  return undefined;
}

/** Map questionnaire answers (camelCase or snake_case) onto a profile upsert body. */
export function answersToProfileBody(
  answers: Record<string, unknown>,
  existing: ProfileRow | null,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    full_name: existing?.full_name ?? pick(answers, 'full_name', 'fullName') ?? 'MySihat user',
    age: pick(answers, 'age') ?? existing?.age ?? 30,
    gender: pick(answers, 'gender', 'sex') ?? existing?.gender ?? 'other',
    state: pick(answers, 'state') ?? existing?.state ?? 'Wilayah Persekutuan Kuala Lumpur',
    activity_level:
      pick(answers, 'activity_level', 'activityLevel') ?? existing?.activity_level ?? 'moderate',
    diet_habit: pick(answers, 'diet_habit', 'dietHabit', 'diet') ?? existing?.diet_habit ?? 'average',
    smoking: pick(answers, 'smoking') ?? existing?.smoking ?? false,
    height_cm: pick(answers, 'height_cm', 'heightCm') ?? existing?.height_cm ?? 165,
    weight_kg: pick(answers, 'weight_kg', 'weightKg') ?? existing?.weight_kg ?? 65,
    alcohol: pick(answers, 'alcohol') ?? existing?.alcohol ?? 'none',
    sleep_hours: pick(answers, 'sleep_hours', 'sleepHours') ?? existing?.sleep_hours ?? 7,
    high_blood_pressure:
      pick(answers, 'high_blood_pressure', 'highBloodPressure') ??
      existing?.high_blood_pressure ??
      false,
    diabetes: pick(answers, 'diabetes') ?? existing?.diabetes ?? false,
    onboarding_complete: true,
    locale: pick(answers, 'locale') ?? existing?.locale ?? 'en',
  };

  // Omit active_action_ids so parseProfileInput preserves existing IDs.
  if (Array.isArray(answers.active_action_ids) || Array.isArray(answers.activeActionIds)) {
    body.active_action_ids = answers.active_action_ids ?? answers.activeActionIds;
  }

  return body;
}

export async function upsertProfileFromQuestionnaire(
  userId: string,
  email: string | null,
  answers: Record<string, unknown>,
): Promise<ProfileInput> {
  const existing = await findProfile(userId);
  const body = answersToProfileBody(answers, existing);
  const input = parseProfileInput(body, email ?? existing?.email ?? null, {
    existingActionIds: existing?.active_action_ids ?? [],
  });
  await upsertProfile(userId, input);
  return input;
}
