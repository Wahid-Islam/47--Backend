import { withRoute } from '../http';
import { listMortalityBaselines } from '../repositories/reference';

/** GET /api/mortality-baselines */
export default withRoute(['GET'], async () => {
  return { baselines: await listMortalityBaselines() };
});
