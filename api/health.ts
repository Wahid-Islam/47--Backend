import { sqlOne } from '../src/db';
import { withRoute } from '../src/http';

/**
 * GET /api/health
 *
 * Liveness plus a real database round trip, so a green response means Neon
 * is reachable and not just that the function booted.
 */
export default withRoute(['GET'], async () => {
  try {
    const row = await sqlOne<{ now: string }>`SELECT now() AS now`;
    return {
      status: 'ok',
      database: row === null ? 'unreachable' : 'ok',
      time: row?.now ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'database error';
    console.error('health check failed:', message);
    return {
      status: 'degraded',
      database: 'unreachable',
      time: null,
      error: message.includes('DATABASE_URL') ? 'DATABASE_URL missing or invalid' : 'database query failed',
    };
  }
});
