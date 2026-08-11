import { sql, sqlOne } from '../db';

export interface HabitLogRow {
  id: string;
  user_id: string;
  log_date: string;
  completed_habit_ids: string[];
}

export async function findHabitLog(userId: string, logDate: string): Promise<HabitLogRow | null> {
  return sqlOne<HabitLogRow>`
    SELECT id, user_id, to_char(log_date, 'YYYY-MM-DD') AS log_date, completed_habit_ids
    FROM habit_logs
    WHERE user_id = ${userId} AND log_date = ${logDate}::date
  `;
}

export async function getOrCreateHabitLog(userId: string, logDate: string): Promise<HabitLogRow> {
  const existing = await findHabitLog(userId, logDate);
  if (existing !== null) return existing;

  await sql`
    INSERT INTO habit_logs (user_id, log_date)
    VALUES (${userId}, ${logDate}::date)
    ON CONFLICT (user_id, log_date) DO NOTHING
  `;

  const row = await findHabitLog(userId, logDate);
  if (row === null) throw new Error('Failed to load habit log');
  return row;
}

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

export async function resetHabitLog(userId: string, logDate: string): Promise<HabitLogRow> {
  return setCompletedHabitIds(userId, logDate, []);
}

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
