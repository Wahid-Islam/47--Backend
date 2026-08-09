-- 003_profile_lifestyle_fields.sql
--
-- Questionnaire now collects height, weight, alcohol and sleep instead of
-- asking for BMI / high blood pressure / state on the wizard. BMI stays as
-- a derived column so existing risk maths keep working.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS height_cm    numeric,
    ADD COLUMN IF NOT EXISTS weight_kg    numeric,
    ADD COLUMN IF NOT EXISTS alcohol      text NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS sleep_hours  numeric NOT NULL DEFAULT 7;

-- Backfill a plausible height/weight pair from existing BMI so demo and
-- older rows still have numbers the UI can show.
UPDATE profiles
SET
    height_cm = 170,
    weight_kg = ROUND((bmi * (1.70 * 1.70))::numeric, 1)
WHERE height_cm IS NULL OR weight_kg IS NULL;

ALTER TABLE profiles
    ALTER COLUMN height_cm SET NOT NULL,
    ALTER COLUMN weight_kg SET NOT NULL,
    ALTER COLUMN height_cm SET DEFAULT 170,
    ALTER COLUMN weight_kg SET DEFAULT 70;

ALTER TABLE profiles
    DROP CONSTRAINT IF EXISTS profiles_alcohol_valid,
    DROP CONSTRAINT IF EXISTS profiles_height_range,
    DROP CONSTRAINT IF EXISTS profiles_weight_range,
    DROP CONSTRAINT IF EXISTS profiles_sleep_range;

ALTER TABLE profiles
    ADD CONSTRAINT profiles_alcohol_valid CHECK (alcohol IN ('none', 'occasional', 'regular')),
    ADD CONSTRAINT profiles_height_range CHECK (height_cm BETWEEN 100 AND 250),
    ADD CONSTRAINT profiles_weight_range CHECK (weight_kg BETWEEN 30 AND 250),
    ADD CONSTRAINT profiles_sleep_range CHECK (sleep_hours BETWEEN 3 AND 14);
