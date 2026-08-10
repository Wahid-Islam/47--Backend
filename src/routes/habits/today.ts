import { jsonBody, requireUser, withRoute } from '../../http';
import { getOrCreateHabitLog, setCompletedHabitIds } from '../../repositories/habits';
import { requireDateKey, requireStringArray } from '../../validation';

/** GET /api/habits/today?date=YYYY-MM-DD -> the day's log, created if absent */
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
