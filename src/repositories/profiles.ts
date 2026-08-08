import { sql, sqlOne } from '../db.ts';

/**
 * Row shape returned to clients.
 *
 * Keys are snake_case on purpose: they mirror the Supabase row shape the
 * Flutter models already parse, so `Profile.fromJson` needs no changes when
 * the app switches from Supabase to this API. `bmi` is `numeric` in
 * Postgres, which the Neon driver returns as a string, so it is cast back
 * to a number before serialising.
 */
export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string;
  age: number;
  gender: string;
  state: string;
  activity_level: string;
  diet_habit: string;
  smoking: boolean;
  bmi: number;
  high_blood_pressure: boolean;
  onboarding_complete: boolean;
  locale: string;
  active_action_ids: string[];
}

export interface ProfileInput {
  email: string | null;
  fullName: string;
  age: number;
  gender: string;
  state: string;
  activityLevel: string;
  dietHabit: string;
  smoking: boolean;
  bmi: number;
  highBloodPressure: boolean;
  onboardingComplete: boolean;
  locale: string;
  activeActionIds: string[];
}

export async function findProfile(userId: string): Promise<ProfileRow | null> {
  const rows = await sql<ProfileRow>`
    SELECT id, email, full_name, age, gender, state, activity_level, diet_habit,
           smoking, bmi::float8 AS bmi, high_blood_pressure, onboarding_complete,
           locale, active_action_ids
    FROM profiles
    WHERE id = ${userId}
  `;
  return rows[0] ?? null;
}

/** Creates the profile row that accompanies a new user. */
export async function createProfile(
  userId: string,
  email: string,
  fullName: string,
): Promise<ProfileRow> {
  const row = await sqlOne<ProfileRow>`
    INSERT INTO profiles (id, email, full_name)
    VALUES (${userId}, ${email}, ${fullName})
    ON CONFLICT (id) DO UPDATE SET
      email     = EXCLUDED.email,
      full_name = EXCLUDED.full_name
    RETURNING id, email, full_name, age, gender, state, activity_level, diet_habit,
              smoking, bmi::float8 AS bmi, high_blood_pressure, onboarding_complete,
              locale, active_action_ids
  `;
  if (row === null) throw new Error('Failed to create profile');
  return row;
}

/**
 * Replaces the caller's profile.
 *
 * `userId` comes from the verified token, never from the request body, so a
 * caller cannot write to someone else's row by sending a different id.
 */
export async function upsertProfile(userId: string, input: ProfileInput): Promise<ProfileRow> {
  const row = await sqlOne<ProfileRow>`
    INSERT INTO profiles (
      id, email, full_name, age, gender, state, activity_level, diet_habit,
      smoking, bmi, high_blood_pressure, onboarding_complete, locale, active_action_ids
    ) VALUES (
      ${userId}, ${input.email}, ${input.fullName}, ${input.age}, ${input.gender},
      ${input.state}, ${input.activityLevel}, ${input.dietHabit}, ${input.smoking},
      ${input.bmi}, ${input.highBloodPressure}, ${input.onboardingComplete},
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
      bmi                 = EXCLUDED.bmi,
      high_blood_pressure = EXCLUDED.high_blood_pressure,
      onboarding_complete = EXCLUDED.onboarding_complete,
      locale              = EXCLUDED.locale,
      active_action_ids   = EXCLUDED.active_action_ids
    RETURNING id, email, full_name, age, gender, state, activity_level, diet_habit,
              smoking, bmi::float8 AS bmi, high_blood_pressure, onboarding_complete,
              locale, active_action_ids
  `;
  if (row === null) throw new Error('Failed to save profile');
  return row;
}
