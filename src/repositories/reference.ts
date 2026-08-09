import { sql } from '../db';

export interface ClinicRow {
  id: string;
  name: string;
  state: string;
  city: string;
  lat: number;
  lng: number;
  services: string[];
}

export interface MortalityBaselineRow {
  cause_id: string;
  cause_name: string;
  cause_name_bm: string;
  gender: string;
  age_min: number;
  age_max: number;
  rate: number;
  source: string;
}

/** Public clinic directory. Contains no personal data. */
export async function listClinics(): Promise<ClinicRow[]> {
  return sql<ClinicRow>`
    SELECT id, name, state, city, lat, lng, services
    FROM clinics
    ORDER BY state, city, name
  `;
}

/**
 * Published baseline mortality rates. `rate` is `numeric`, which the driver
 * returns as a string, so it is cast to a float for the JSON response.
 */
export async function listMortalityBaselines(): Promise<MortalityBaselineRow[]> {
  return sql<MortalityBaselineRow>`
    SELECT cause_id, cause_name, cause_name_bm, gender, age_min, age_max,
           rate::float8 AS rate, source
    FROM national_mortality_baselines
    ORDER BY cause_id, gender, age_min
  `;
}
