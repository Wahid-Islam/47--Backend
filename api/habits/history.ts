import { requireUser, withRoute } from '../../src/http.ts';
import { listRecentHabitLogs } from '../../src/repositories/habits.ts';

/**
 * GET /api/habits/history?days=7
 * Recent habit logs used for streak / day-by-day risk drop.
 */
export default withRoute(['GET'], async (request) => {
  const { userId } = await requireUser(request);
  const raw = request.query.days;
  const days = typeof raw === 'string' ? Number.parseInt(raw, 10) : 7;
  const logs = await listRecentHabitLogs(userId, Number.isFinite(days) ? days : 7);
  return { logs };
});
