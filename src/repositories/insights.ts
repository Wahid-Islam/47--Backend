import { sql, sqlOne } from '../db';

export interface InsightsRow {
  user_id: string;
  payload: Record<string, unknown>;
  generated_at: string;
}

export async function findInsights(userId: string): Promise<InsightsRow | null> {
  const rows = await sql<InsightsRow>`
    SELECT user_id, payload, generated_at
    FROM insights
    WHERE user_id = ${userId}
  `;
  return rows[0] ?? null;
}

/**
 * Replaces the caller's insights row.
 *
 * The payload is the risk engine's output, which still runs on-device in
 * the Flutter app -- this API only persists it. `payload` is stored as
 * `jsonb`, so new fields can be added without a migration, which is how the
 * Epic 1.0 comparison fields were introduced.
 */
export async function upsertInsights(
  userId: string,
  payload: Record<string, unknown>,
  generatedAt: string,
): Promise<InsightsRow> {
  const row = await sqlOne<InsightsRow>`
    INSERT INTO insights (user_id, payload, generated_at)
    VALUES (${userId}, ${JSON.stringify(payload)}::jsonb, ${generatedAt})
    ON CONFLICT (user_id) DO UPDATE SET
      payload      = EXCLUDED.payload,
      generated_at = EXCLUDED.generated_at
    RETURNING user_id, payload, generated_at
  `;
  if (row === null) throw new Error('Failed to save insights');
  return row;
}
