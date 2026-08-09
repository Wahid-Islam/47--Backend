import { sql, sqlOne } from '../db';

export interface HabitLogRow {
  id: string;
  user_id: string;
  log_date: string;
  completed_habit_ids: string[];
}

// `log_date` is a Postgres `date`, which the driver hands back as a JS Date
// in UTC. The Flutter model expects `YYYY-MM-DD`, so every query formats it
// with `to_char` rather than converting in JS, where a timezone offset could
// shift it by a day.

/**
 * Returns the caller's habit log for a day, creating an empty one if it
 * doesn't exist yet.
 *
 * Done as a single upsert rather than select-then-insert so two concurrent
 * requests on the same day cannot both try to insert.
 */
export async function getOrCreateHabitLog(userId: string, logDate: string): Promise<HabitLogRow> {
  const row = await sqlOne<HabitLogRow>`
    INSERT INTO habit_logs (user_id, log_date)
    VALUES (${userId}, ${logDate}::date)
    ON CONFLICT (user_id, log_date) DO UPDATE SET
      completed_habit_ids = habit_logs.completed_habit_ids
    RETURNING id, user_id, to_char(log_date, 'YYYY-MM-DD') AS log_date, completed_habit_ids
  `;
  if (row === null) throw new Error('Failed to load habit log');
  return row;
}

/** Replaces the completed habit ids for one of the caller's days. */
export async function setCompletedHabitIds(
  userId: string,
  logDate: string,
  completedHabitIds: string[],
): Promise<HabitLogRow> {
  const row = await sqlOne<HabitLogRow>`
    INSERT INTO habit_logs (user_id, log_date, completed_habit_ids)
    VALUES (${userId}, ${logDate}::date, ${completedHabitIds})
    ON CONFLICT (user_id, log_date) DO UPDATE SET
      completed_habit_ids = EXCLUDED.completed_habit_ids
    RETURNING id, user_id, to_char(log_date, 'YYYY-MM-DD') AS log_date, completed_habit_ids
  `;
  if (row === null) throw new Error('Failed to save habit log');
  return row;
}

/** Recent habit logs for streak / day-by-day risk progress (newest first). */
export async function listRecentHabitLogs(userId: string, days: number): Promise<HabitLogRow[]> {
  const limit = Math.max(1, Math.min(days, 30));
  return sql<HabitLogRow>`
    SELECT id, user_id, to_char(log_date, 'YYYY-MM-DD') AS log_date, completed_habit_ids
    FROM habit_logs
    WHERE user_id = ${userId}
      AND log_date >= (CURRENT_DATE - (${limit}::int - 1))
    ORDER BY log_date DESC
  `;
}
