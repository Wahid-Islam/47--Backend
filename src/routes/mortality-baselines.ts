import { withRoute } from '../http';
import { listMortalityBaselines } from '../repositories/reference';

/**
 * GET /api/mortality-baselines
 *
 * Public: these are published population statistics, not user data.
 *
 * The Flutter app currently uses its own bundled copy of these curves
 * (`dosm_data.dart`) so the risk engine can run offline. This endpoint
 * exists so the figures can be corrected server-side without shipping a new
 * client build -- see docs/ROADMAP.md.
 */
export default withRoute(['GET'], async () => {
  return { baselines: await listMortalityBaselines() };
});
