import { badRequest } from '../http';
import { parseProfileInput } from '../profileInput';
import type { ProfileInput, ProfileRow } from '../repositories/profiles';
import { findProfile } from '../repositories/profiles';
import { upsertProfileWithQuestionnaireAudit } from '../repositories/questionnaire';

function pick(answers: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (answers[key] !== undefined) return answers[key];
  }
  return undefined;
}

function requireAnswer(answers: Record<string, unknown>, keys: string[], label: string): unknown {
  const value = pick(answers, ...keys);
  if (value === undefined || value === null || value === '') {
    throw badRequest(`Questionnaire answers must include "${label}"`);
  }
  return value;
}

/** Ensures the questionnaire payload has the health fields needed to personalise the profile. */
export function assertQuestionnaireComplete(answers: Record<string, unknown>): void {
  requireAnswer(answers, ['age'], 'age');
  requireAnswer(answers, ['gender', 'sex'], 'gender');
  requireAnswer(answers, ['smoking'], 'smoking');
  requireAnswer(answers, ['height_cm', 'heightCm'], 'heightCm');
  requireAnswer(answers, ['weight_kg', 'weightKg'], 'weightKg');
  requireAnswer(answers, ['activity_level', 'activityLevel'], 'activityLevel');
  requireAnswer(answers, ['diet_habit', 'dietHabit', 'diet'], 'diet');
  requireAnswer(answers, ['alcohol'], 'alcohol');
  requireAnswer(answers, ['sleep_hours', 'sleepHours'], 'sleepHours');
  requireAnswer(answers, ['high_blood_pressure', 'highBloodPressure'], 'highBloodPressure');
  requireAnswer(answers, ['diabetes'], 'diabetes');
}

/** Map questionnaire answers onto a profile body. Required health fields come only from answers. */
export function answersToProfileBody(
  answers: Record<string, unknown>,
  existing: ProfileRow | null,
): Record<string, unknown> {
  assertQuestionnaireComplete(answers);

  const body: Record<string, unknown> = {
    full_name: existing?.full_name ?? pick(answers, 'full_name', 'fullName') ?? 'MySihat user',
    age: pick(answers, 'age'),
    gender: pick(answers, 'gender', 'sex'),
    state: pick(answers, 'state') ?? existing?.state ?? 'Wilayah Persekutuan Kuala Lumpur',
    activity_level: pick(answers, 'activity_level', 'activityLevel'),
    diet_habit: pick(answers, 'diet_habit', 'dietHabit', 'diet'),
    smoking: pick(answers, 'smoking'),
    height_cm: pick(answers, 'height_cm', 'heightCm'),
    weight_kg: pick(answers, 'weight_kg', 'weightKg'),
    alcohol: pick(answers, 'alcohol'),
    sleep_hours: pick(answers, 'sleep_hours', 'sleepHours'),
    high_blood_pressure: pick(answers, 'high_blood_pressure', 'highBloodPressure'),
    diabetes: pick(answers, 'diabetes'),
    onboarding_complete: true,
    locale: pick(answers, 'locale') ?? existing?.locale ?? 'en',
  };

  if (Array.isArray(answers.active_action_ids) || Array.isArray(answers.activeActionIds)) {
    body.active_action_ids = answers.active_action_ids ?? answers.activeActionIds;
  }

  return body;
}

export async function saveQuestionnaireAndProfile(
  userId: string,
  email: string | null,
  answers: Record<string, unknown>,
): Promise<{ profile: ProfileInput; questionnaireId: string; submittedAt: string }> {
  const existing = await findProfile(userId);
  const body = answersToProfileBody(answers, existing);
  const input = parseProfileInput(body, email ?? existing?.email ?? null, {
    existingActionIds: existing?.active_action_ids ?? [],
  });
  const audit = await upsertProfileWithQuestionnaireAudit(userId, input, answers);
  return {
    profile: input,
    questionnaireId: audit.id,
    submittedAt: audit.submitted_at,
  };
}
