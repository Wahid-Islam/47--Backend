import { jsonBody, requireUser, withRoute } from '../../http.ts';
import { getOrCreateHabitLog, setCompletedHabitIds } from '../../repositories/habits.ts';
import { requireDateKey, requireStringArray } from '../../validation.ts';

/**
 * GET /api/habits/today?date=YYYY-MM-DD -> the day's log, created if absent
 * PUT /api/habits/today                 -> body { date?, completed_habit_ids }
 *
 * `date` is optional and defaults to today in UTC. It is a parameter rather
 * than being derived server-side because the user's calendar day is the one
 * that matters, and their timezone is only known to the client.
 */
export default withRoute(['GET', 'PUT'], async (request) => {
  const { userId } = await requireUser(request);

  if (request.method === 'GET') {
    const date = requireDateKey(request.query.date);
    return getOrCreateHabitLog(userId, date);
  }

  const body = jsonBody(request);
  const date = requireDateKey(body.date);
  const completedHabitIds = requireStringArray(body, 'completed_habit_ids');

  return setCompletedHabitIds(userId, date, completedHabitIds);
});
