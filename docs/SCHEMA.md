# Database schema

Neon Postgres, provisioned through Vercel (`neon-beige-pillow`).

Ported from the Supabase project so that column names, types and defaults
match exactly — that is what lets the Flutter models parse API responses
unchanged.

## Migrations

Plain SQL in `migrations/`, applied in filename order:

| File | Contents |
|---|---|
| `001_initial_schema.sql` | Tables, constraints, triggers |
| `002_seed_reference_data.sql` | Clinics and mortality baselines |

```bash
npm run migrate
```

The runner (`scripts/migrate.ts`) records applied filenames in
`schema_migrations`, so it is idempotent. Each file runs inside a transaction
and rolls back on failure, so nothing is ever half-applied.

It uses `pg` over TCP rather than the Neon HTTP driver the API uses, for two
reasons: the HTTP driver sends one statement per request while these files
contain many (including dollar-quoted function bodies), and migrations need a
real transaction. It also prefers `DATABASE_URL_UNPOOLED`, because DDL wants
one stable session rather than PgBouncer handing out a different one per
statement.

**To add a migration**, create `003_<description>.sql`. Never edit an applied
file — it will be skipped on every machine that already ran it, so the change
silently never happens.

## Tables

### `users`

Identity. This table did not exist on Supabase, where `auth.users` was
managed for us.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `email` | `text` | Unique on `lower(email)` |
| `password_hash` | `text` | scrypt, see [AUTH.md](AUTH.md) |
| `created_at`, `updated_at` | `timestamptz` | |

### `profiles`

The user's current questionnaire answers. One row per user.

| Column | Type | Default |
|---|---|---|
| `id` | `uuid` | PK, FK → `users.id` `ON DELETE CASCADE` |
| `email` | `text` | nullable |
| `full_name` | `text` | `''` |
| `age` | `integer` | `48` |
| `gender` | `text` | `'male'` |
| `state` | `text` | `'Wilayah Persekutuan Kuala Lumpur'` |
| `activity_level` | `text` | `'moderate'` |
| `diet_habit` | `text` | `'average'` |
| `smoking` | `boolean` | `false` |
| `bmi` | `numeric` | `24` |
| `high_blood_pressure` | `boolean` | `false` |
| `onboarding_complete` | `boolean` | `false` |
| `locale` | `text` | `'en'` |
| `active_action_ids` | `text[]` | `'{}'` |
| `created_at`, `updated_at` | `timestamptz` | `now()` |

**New in this port: `CHECK` constraints.** On Supabase these bounds existed
only in the Flutter form, so a crafted request could store an age of 500.

| Constraint | Rule |
|---|---|
| `profiles_age_range` | 18–90 |
| `profiles_bmi_range` | 10–60 |
| `profiles_gender_valid` | `male`, `female`, `other` |
| `profiles_activity_valid` | `low`, `moderate`, `high` |
| `profiles_diet_valid` | `unhealthy`, `average`, `healthy` |
| `profiles_locale_valid` | `en`, `bm` |

The API validates the same bounds first, so users get a readable message
instead of a constraint violation. The constraints are the backstop for when
a validator is missed.

`bmi` is `numeric`, which the driver returns as a *string*. Every query casts
it with `bmi::float8` so JSON gets a number.

### `insights`

The risk engine's output. One row per user, enforced by
`UNIQUE (user_id)`, which is what `PUT /api/insights` upserts on.

| Column | Type |
|---|---|
| `id` | `uuid` PK |
| `user_id` | `uuid` FK → `users.id`, unique |
| `payload` | `jsonb` |
| `generated_at` | `timestamptz` |

`payload` is `jsonb` and deliberately unvalidated by the database. Its shape
is owned by the Flutter `Insights` model, which is how the Epic 1.0
comparison fields (`peerAverageHealthAge`, `healthAgeDelta`, the projections)
were added without a migration.

### `habit_logs`

One row per user per calendar day, enforced by
`UNIQUE (user_id, log_date)` — the constraint the get-or-create upsert relies
on to be safe under concurrent requests.

| Column | Type |
|---|---|
| `id` | `uuid` PK |
| `user_id` | `uuid` FK → `users.id` |
| `log_date` | `date` |
| `completed_habit_ids` | `text[]` |
| `created_at`, `updated_at` | `timestamptz` |

`log_date` is selected with `to_char(log_date, 'YYYY-MM-DD')` rather than
converted in JavaScript, where a timezone offset can shift the date by a day.

### `questionnaire_responses`

Append-only audit trail (US 1.1). The mutable `profiles` row holds the
current answers; this records what was submitted each time.

| Column | Type |
|---|---|
| `id` | `uuid` PK |
| `user_id` | `uuid` FK → `users.id` |
| `answers` | `jsonb` |
| `submitted_at` | `timestamptz` |

Indexed on `(user_id, submitted_at DESC)`. There is no update or delete path.

### `clinics`

Public reference data, seeded with 6 Klinik Kesihatan rows. No personal data,
so `GET /api/clinics` needs no token.

| Column | Type |
|---|---|
| `id` | `text` PK |
| `name`, `state`, `city` | `text` |
| `lat`, `lng` | `double precision` |
| `services` | `text[]` |

### `national_mortality_baselines`

Public reference data, seeded with 24 rows: 4 causes × 2 genders × 3 age
bands.

| Column | Type |
|---|---|
| `id` | `bigserial` PK |
| `cause_id`, `cause_name`, `cause_name_bm` | `text` |
| `gender` | `text` |
| `age_min`, `age_max` | `integer` |
| `rate` | `numeric`, cast to `float8` on read |
| `source` | `text` |

`UNIQUE (cause_id, gender, age_min, age_max)` makes the seed idempotent.

These are **DOSM-inspired MVP figures, not published DOSM statistics**.
Replacing them with cited real data is in [ROADMAP.md](ROADMAP.md).

## No Row Level Security

Every Supabase table had RLS with owner-only policies. There are none here,
deliberately — the API connects as one privileged role, so `auth.uid()` has
no meaning and a policy would either block everything or nothing. Ownership
is enforced in the API. See [SECURITY.md](SECURITY.md).

## `updated_at`

`set_updated_at()` is a `BEFORE UPDATE` trigger on `users`, `profiles` and
`habit_logs`. It is declared `SECURITY INVOKER` with
`SET search_path = pg_catalog, public` — a `SECURITY DEFINER` function with a
mutable `search_path` is a standard privilege-escalation vector, and this was
one of the advisor warnings fixed on the Supabase project.

## Inspecting the database

Vercel dashboard → Storage → `neon-beige-pillow` → **Open in Neon Console**,
then use the SQL Editor:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at;
SELECT count(*) FROM users;
```
