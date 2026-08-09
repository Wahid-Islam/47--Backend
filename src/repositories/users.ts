import { sql, sqlOne } from '../db';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

export interface PublicUser {
  id: string;
  email: string;
}

/** Looks a user up by email, case-insensitively. */
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

/**
 * Creates a user, or returns null if the email is already taken.
 *
 * `ON CONFLICT DO NOTHING` against the case-insensitive unique index makes
 * this atomic: two simultaneous registrations for the same email cannot
 * both succeed, which a check-then-insert would allow.
 */
export async function createUser(email: string, passwordHash: string): Promise<PublicUser | null> {
  // Expression unique indexes need a parenthesised conflict target:
  // ON CONFLICT ((lower(email))), not ON CONFLICT (lower(email)).
  return sqlOne<PublicUser>`
    INSERT INTO users (email, password_hash)
    VALUES (${email}, ${passwordHash})
    ON CONFLICT ((lower(email))) DO NOTHING
    RETURNING id, email
  `;
}
