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
