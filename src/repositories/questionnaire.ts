import { sqlOne } from '../db';
import type { ProfileInput, ProfileRow } from './profiles';

export interface QuestionnaireResponseRow {
  id: string;
  user_id: string;
  submitted_at: string;
}

/** Profile upsert + questionnaire audit insert in one statement (no orphaned half-write). */
export async function upsertProfileWithQuestionnaireAudit(
  userId: string,
  input: ProfileInput,
  answers: Record<string, unknown>,
): Promise<QuestionnaireResponseRow> {
  const row = await sqlOne<QuestionnaireResponseRow>`
    WITH profile AS (
      INSERT INTO profiles (
        id, email, full_name, age, gender, state, activity_level, diet_habit,
        smoking, height_cm, weight_kg, bmi, alcohol, sleep_hours,
        high_blood_pressure, diabetes, onboarding_complete, locale, active_action_ids
      ) VALUES (
        ${userId}, ${input.email}, ${input.fullName}, ${input.age}, ${input.gender},
        ${input.state}, ${input.activityLevel}, ${input.dietHabit}, ${input.smoking},
        ${input.heightCm}, ${input.weightKg}, ${input.bmi}, ${input.alcohol}, ${input.sleepHours},
        ${input.highBloodPressure}, ${input.diabetes}, ${input.onboardingComplete},
        ${input.locale}, ${input.activeActionIds}
      )
      ON CONFLICT (id) DO UPDATE SET
        email               = EXCLUDED.email,
        full_name           = EXCLUDED.full_name,
        age                 = EXCLUDED.age,
        gender              = EXCLUDED.gender,
        state               = EXCLUDED.state,
        activity_level      = EXCLUDED.activity_level,
        diet_habit          = EXCLUDED.diet_habit,
        smoking             = EXCLUDED.smoking,
        height_cm           = EXCLUDED.height_cm,
        weight_kg           = EXCLUDED.weight_kg,
        bmi                 = EXCLUDED.bmi,
        alcohol             = EXCLUDED.alcohol,
        sleep_hours         = EXCLUDED.sleep_hours,
        high_blood_pressure = EXCLUDED.high_blood_pressure,
        diabetes            = EXCLUDED.diabetes,
        onboarding_complete = EXCLUDED.onboarding_complete,
        locale              = EXCLUDED.locale,
        active_action_ids   = EXCLUDED.active_action_ids
      RETURNING id
    )
    INSERT INTO questionnaire_responses (user_id, answers)
    SELECT profile.id, ${JSON.stringify(answers)}::jsonb FROM profile
    RETURNING id, user_id, submitted_at
  `;
  if (row === null) throw new Error('Failed to save questionnaire and profile');
  return row;
}

export async function insertQuestionnaireResponse(
  userId: string,
  answers: Record<string, unknown>,
): Promise<QuestionnaireResponseRow> {
  const row = await sqlOne<QuestionnaireResponseRow>`
    INSERT INTO questionnaire_responses (user_id, answers)
    VALUES (${userId}, ${JSON.stringify(answers)}::jsonb)
    RETURNING id, user_id, submitted_at
  `;
  if (row === null) throw new Error('Failed to record questionnaire response');
  return row;
}

export type { ProfileRow };
