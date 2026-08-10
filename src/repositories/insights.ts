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
