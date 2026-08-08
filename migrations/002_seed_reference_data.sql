-- 002_seed_reference_data.sql
--
-- Public reference data, exported from the Supabase project so the Neon
-- database starts with identical content. Both inserts are idempotent, so
-- re-running the migration is safe.

INSERT INTO clinics (id, name, state, city, lat, lng, services) VALUES
    ('kk-bangsar',    'Klinik Kesihatan Bangsar',    'Wilayah Persekutuan Kuala Lumpur', 'Bangsar',     3.1319, 101.6710, '{blood_pressure,blood_sugar,general}'),
    ('kk-cheras',     'Klinik Kesihatan Cheras',     'Wilayah Persekutuan Kuala Lumpur', 'Cheras',      3.1065, 101.7321, '{blood_pressure,blood_sugar,general}'),
    ('kk-penang',     'Klinik Kesihatan Bayan Baru', 'Pulau Pinang',                     'Bayan Baru',  5.3271, 100.2861, '{blood_pressure,blood_sugar,general}'),
    ('kk-jb',         'Klinik Kesihatan Johor Bahru','Johor',                            'Johor Bahru', 1.4927, 103.7414, '{blood_pressure,blood_sugar,general}'),
    ('kk-ipoh',       'Klinik Kesihatan Greentown',  'Perak',                            'Ipoh',        4.5975, 101.0901, '{blood_pressure,blood_sugar,general}'),
    ('kk-bukit-baru', 'Klinik Kesihatan Bukit Baru', 'Melaka',                           'Bukit Baru',  2.2215, 102.2642, '{blood_pressure,blood_sugar,general}')
ON CONFLICT (id) DO UPDATE SET
    name     = EXCLUDED.name,
    state    = EXCLUDED.state,
    city     = EXCLUDED.city,
    lat      = EXCLUDED.lat,
    lng      = EXCLUDED.lng,
    services = EXCLUDED.services;

-- Cause-of-death baseline rates by cause, gender and 10-year age band.
-- These are DOSM-*inspired* MVP figures, not published DOSM statistics --
-- replacing them with cited real data is tracked in docs/ROADMAP.md.
INSERT INTO national_mortality_baselines
    (cause_id, cause_name, cause_name_bm, gender, age_min, age_max, rate) VALUES
    ('cardiovascular',         'Cardiovascular Disease',         'Penyakit Kardiovaskular',       'male',   40, 49, 0.18),
    ('cardiovascular',         'Cardiovascular Disease',         'Penyakit Kardiovaskular',       'male',   50, 59, 0.28),
    ('cardiovascular',         'Cardiovascular Disease',         'Penyakit Kardiovaskular',       'male',   60, 69, 0.36),
    ('cardiovascular',         'Cardiovascular Disease',         'Penyakit Kardiovaskular',       'female', 40, 49, 0.12),
    ('cardiovascular',         'Cardiovascular Disease',         'Penyakit Kardiovaskular',       'female', 50, 59, 0.20),
    ('cardiovascular',         'Cardiovascular Disease',         'Penyakit Kardiovaskular',       'female', 60, 69, 0.29),
    ('diabetes_complications', 'Diabetes-related Complications', 'Komplikasi Berkaitan Diabetes', 'male',   40, 49, 0.08),
    ('diabetes_complications', 'Diabetes-related Complications', 'Komplikasi Berkaitan Diabetes', 'male',   50, 59, 0.14),
    ('diabetes_complications', 'Diabetes-related Complications', 'Komplikasi Berkaitan Diabetes', 'male',   60, 69, 0.19),
    ('diabetes_complications', 'Diabetes-related Complications', 'Komplikasi Berkaitan Diabetes', 'female', 40, 49, 0.09),
    ('diabetes_complications', 'Diabetes-related Complications', 'Komplikasi Berkaitan Diabetes', 'female', 50, 59, 0.15),
    ('diabetes_complications', 'Diabetes-related Complications', 'Komplikasi Berkaitan Diabetes', 'female', 60, 69, 0.20),
    ('respiratory',            'Chronic Respiratory Disease',    'Penyakit Pernafasan Kronik',    'male',   40, 49, 0.06),
    ('respiratory',            'Chronic Respiratory Disease',    'Penyakit Pernafasan Kronik',    'male',   50, 59, 0.10),
    ('respiratory',            'Chronic Respiratory Disease',    'Penyakit Pernafasan Kronik',    'male',   60, 69, 0.15),
    ('respiratory',            'Chronic Respiratory Disease',    'Penyakit Pernafasan Kronik',    'female', 40, 49, 0.04),
    ('respiratory',            'Chronic Respiratory Disease',    'Penyakit Pernafasan Kronik',    'female', 50, 59, 0.07),
    ('respiratory',            'Chronic Respiratory Disease',    'Penyakit Pernafasan Kronik',    'female', 60, 69, 0.11),
    ('cancer',                 'Cancer (all sites)',             'Kanser (semua jenis)',          'male',   40, 49, 0.10),
    ('cancer',                 'Cancer (all sites)',             'Kanser (semua jenis)',          'male',   50, 59, 0.17),
    ('cancer',                 'Cancer (all sites)',             'Kanser (semua jenis)',          'male',   60, 69, 0.24),
    ('cancer',                 'Cancer (all sites)',             'Kanser (semua jenis)',          'female', 40, 49, 0.11),
    ('cancer',                 'Cancer (all sites)',             'Kanser (semua jenis)',          'female', 50, 59, 0.16),
    ('cancer',                 'Cancer (all sites)',             'Kanser (semua jenis)',          'female', 60, 69, 0.22)
ON CONFLICT (cause_id, gender, age_min, age_max) DO UPDATE SET
    cause_name    = EXCLUDED.cause_name,
    cause_name_bm = EXCLUDED.cause_name_bm,
    rate          = EXCLUDED.rate;
