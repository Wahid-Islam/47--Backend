import { withRoute } from '../http';
import { listClinics } from '../repositories/reference';

/** GET /api/clinics */
export default withRoute(['GET'], async () => {
  return { clinics: await listClinics() };
});
