import { sqlOne } from '../src/db.ts';
import { withRoute } from '../src/http.ts';

/**
 * GET /api/health
 *
 * Liveness plus a real database round trip, so a green response means Neon
 * is reachable and not just that the function booted.
 */
export default withRoute(['GET'], async () => {
  const row = await sqlOne<{ now: string }>`SELECT now() AS now`;
  return {
    status: 'ok',
    database: row === null ? 'unreachable' : 'ok',
    time: row?.now ?? null,
  };
});
