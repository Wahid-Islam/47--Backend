import { sql, sqlOne } from '../db';
import type { ProfileRow } from './profiles';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

export interface PublicUser {
  id: string;
  email: string;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await sql<UserRow>`
    SELECT id, email, password_hash
    FROM users
    WHERE lower(email) = lower(${email})
  `;
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const rows = await sql<PublicUser>`SELECT id, email FROM users WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function createUser(email: string, passwordHash: string): Promise<PublicUser | null> {
  return sqlOne<PublicUser>`
    INSERT INTO users (email, password_hash)
    VALUES (${email}, ${passwordHash})
    ON CONFLICT ((lower(email))) DO NOTHING
    RETURNING id, email
  `;
}

export interface RegisteredAccount {
  user: PublicUser;
  profile: ProfileRow;
}

/** Create user + initial profile in one statement so neither can orphan the other. */
export async function createUserWithProfile(
  email: string,
  passwordHash: string,
  fullName: string,
): Promise<RegisteredAccount | null> {
  const row = await sqlOne<ProfileRow & { user_id: string; user_email: string }>`
    WITH inserted AS (
      INSERT INTO users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      ON CONFLICT ((lower(email))) DO NOTHING
      RETURNING id, email
    ),
    profile AS (
      INSERT INTO profiles (id, email, full_name)
      SELECT id, email, ${fullName} FROM inserted
      RETURNING id, email, full_name, age, gender, state, activity_level, diet_habit,
                smoking, height_cm::float8 AS height_cm, weight_kg::float8 AS weight_kg,
                bmi::float8 AS bmi, alcohol, sleep_hours::float8 AS sleep_hours,
                high_blood_pressure, diabetes, onboarding_complete, locale, active_action_ids
    )
    SELECT
      inserted.id AS user_id,
      inserted.email AS user_email,
      profile.id, profile.email, profile.full_name, profile.age, profile.gender, profile.state,
      profile.activity_level, profile.diet_habit, profile.smoking,
      profile.height_cm, profile.weight_kg, profile.bmi, profile.alcohol, profile.sleep_hours,
      profile.high_blood_pressure, profile.diabetes, profile.onboarding_complete,
      profile.locale, profile.active_action_ids
    FROM inserted
    JOIN profile ON profile.id = inserted.id
  `;

  if (row === null) return null;

  const {
    user_id: userId,
    user_email: userEmail,
    ...profile
  } = row;

  return {
    user: { id: userId, email: userEmail },
    profile,
  };
}
