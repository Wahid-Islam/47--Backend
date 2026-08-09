import { withRoute } from '../http';
import { listClinics } from '../repositories/reference';

/**
 * GET /api/clinics
 *
 * Public: no token required, matching the Supabase policy that allowed
 * anonymous reads. The table holds no personal data, and the app shows
 * nearby clinics before a user signs in.
 *
 * Distance ranking stays on the client, which is the only side that knows
 * the user's location.
 */
export default withRoute(['GET'], async () => {
  return { clinics: await listClinics() };
});
