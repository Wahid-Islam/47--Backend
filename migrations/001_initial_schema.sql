-- 001_initial_schema.sql
--
-- Ported from the Supabase schema. Two things are deliberately different:
--
--  1. `users` is a real table here. Supabase Auth owned `auth.users` and
--     hashed passwords for us; Neon is plain Postgres, so the API owns
--     identity. See docs/AUTH.md.
--
--  2. There are no Row Level Security policies. RLS worked on Supabase
--     because the client connected as the end user, with `auth.uid()`
--     resolving from their JWT. Here the API connects with one privileged
--     Neon role, so `auth.uid()` has no meaning and RLS would either block
--     everything or nothing. Ownership is enforced in the API instead:
--     every user-scoped query filters on the `user_id` taken from the
--     verified JWT, never from the request body. See docs/SECURITY.md.
--
-- Column names, types and defaults otherwise match Supabase exactly, so the
-- Flutter models keep working unchanged.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Identity -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness: "A@b.com" and "a@b.com" are one account.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

-- User data ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
    id                  uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    email               text,
    full_name           text NOT NULL DEFAULT '',
    age                 integer NOT NULL DEFAULT 48,
    gender              text NOT NULL DEFAULT 'male',
    state               text NOT NULL DEFAULT 'Wilayah Persekutuan Kuala Lumpur',
    activity_level      text NOT NULL DEFAULT 'moderate',
    diet_habit          text NOT NULL DEFAULT 'average',
    smoking             boolean NOT NULL DEFAULT false,
    bmi                 numeric NOT NULL DEFAULT 24,
    high_blood_pressure boolean NOT NULL DEFAULT false,
    onboarding_complete boolean NOT NULL DEFAULT false,
    locale              text NOT NULL DEFAULT 'en',
    active_action_ids   text[] NOT NULL DEFAULT '{}'::text[],
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    -- These bounds were only enforced in the Flutter form on Supabase, so a
    -- crafted request could store anything. They are constraints now.
    CONSTRAINT profiles_age_range CHECK (age BETWEEN 18 AND 90),
    CONSTRAINT profiles_bmi_range CHECK (bmi BETWEEN 10 AND 60),
    CONSTRAINT profiles_gender_valid CHECK (gender IN ('male', 'female', 'other')),
    CONSTRAINT profiles_activity_valid CHECK (activity_level IN ('low', 'moderate', 'high')),
    CONSTRAINT profiles_diet_valid CHECK (diet_habit IN ('unhealthy', 'average', 'healthy')),
    CONSTRAINT profiles_locale_valid CHECK (locale IN ('en', 'bm'))
);

CREATE TABLE IF NOT EXISTS insights (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    payload      jsonb NOT NULL,
    generated_at timestamptz NOT NULL DEFAULT now(),

    -- One current insights row per user; the API upserts on this.
    CONSTRAINT insights_user_id_key UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS habit_logs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    log_date            date NOT NULL,
    completed_habit_ids text[] NOT NULL DEFAULT '{}'::text[],
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    -- One row per user per calendar day.
    CONSTRAINT habit_logs_user_date_key UNIQUE (user_id, log_date)
);

-- Append-only audit trail of questionnaire submissions (US 1.1). The
-- mutable `profiles` row holds the current answers; this never changes.
CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    answers      jsonb NOT NULL,
    submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questionnaire_responses_user_idx
    ON questionnaire_responses (user_id, submitted_at DESC);

-- Public reference data ------------------------------------------------

CREATE TABLE IF NOT EXISTS clinics (
    id       text PRIMARY KEY,
    name     text NOT NULL,
    state    text NOT NULL,
    city     text NOT NULL,
    lat      double precision NOT NULL,
    lng      double precision NOT NULL,
    services text[] NOT NULL DEFAULT '{}'::text[]
);

CREATE TABLE IF NOT EXISTS national_mortality_baselines (
    id             bigserial PRIMARY KEY,
    cause_id       text NOT NULL,
    cause_name     text NOT NULL,
    cause_name_bm  text NOT NULL,
    gender         text NOT NULL,
    age_min        integer NOT NULL,
    age_max        integer NOT NULL,
    rate           numeric NOT NULL,
    source         text NOT NULL DEFAULT 'DOSM-inspired MVP baseline',

    CONSTRAINT baselines_unique UNIQUE (cause_id, gender, age_min, age_max)
);

-- updated_at maintenance -----------------------------------------------

-- SECURITY INVOKER with a pinned search_path. A SECURITY DEFINER function
-- with a mutable search_path is a standard privilege-escalation vector.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS habit_logs_set_updated_at ON habit_logs;
CREATE TRIGGER habit_logs_set_updated_at
    BEFORE UPDATE ON habit_logs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
