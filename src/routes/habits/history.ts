import { requireUser, withRoute } from '../../http';
import { listRecentHabitLogs } from '../../repositories/habits';
import { todayInAppTz } from '../../time';

/** GET /api/habits/history?days=7 */
export default withRoute(['GET'], async (request) => {
  const { userId } = await requireUser(request);
  const raw = request.query.days;
  const days = typeof raw === 'string' ? Number.parseInt(raw, 10) : 7;
  const logs = await listRecentHabitLogs(
    userId,
    Number.isFinite(days) ? days : 7,
    todayInAppTz(),
  );
  return { logs };
});
