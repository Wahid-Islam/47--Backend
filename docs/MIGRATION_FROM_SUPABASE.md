# Migrating from Supabase to Neon

The frontend still runs on Supabase. This documents what changed, and the
steps to switch over once this API is deployed and verified.

## Why the frontend can't just point at Neon

Supabase was callable from the browser because its anon key authorises
nothing on its own — Row Level Security enforced access inside Postgres,
keyed to the signed-in user's JWT.

Neon hands you a `DATABASE_URL`: a full-privilege Postgres credential. In a
Flutter web bundle it would be readable in DevTools, exposing the entire
database to anyone who loads the page. `@neondatabase/serverless` is also
JavaScript-only, with no browser-safe Dart equivalent.

So the switch is not "change a connection string". It needs this API in
between, which is why it exists.

## What Supabase was doing for free

| Supabase feature | Replacement |
|---|---|
| Auth: signup, login, sessions | `POST /api/auth/register`, `/login`, `/api/auth/me` |
| Password storage | scrypt in `src/auth/password.ts` |
| `onAuthStateChange` stream | Client polls `GET /api/auth/me` on start-up |
| RLS on `auth.uid()` | Ownership checks in every handler ([SECURITY.md](SECURITY.md)) |
| Auto-created profile trigger | `createProfile` inside the register handler |
| Generated REST endpoints | The handlers in `api/` |

## What did not change

**Column names, types and defaults are identical**, and responses use the
same `snake_case` keys the Supabase client returned. That is the whole reason
the frontend cutover is small: `Profile.fromJson`, `Insights.fromJson`,
`HabitLogRow.fromJson` and `Clinic.fromJson` all keep working untouched.

The risk engine also stays on-device in Dart. This API only persists its
output.

## What got stricter

Age and BMI bounds are now `CHECK` constraints, and `gender`,
`activity_level`, `diet_habit` and `locale` are constrained to their allowed
values. On Supabase these lived only in the Flutter form, so a crafted
request could store anything. See [SCHEMA.md](SCHEMA.md).

## Cutover steps

### 1. Deploy and verify the API

Follow [DEPLOY.md](DEPLOY.md). Confirm `/api/health` reports
`"database":"ok"`, then register a throwaway account and complete a profile
against the deployed URL.

### 2. Add the frontend origin to CORS

`CORS_ALLOWED_ORIGINS` must contain the deployed frontend origin exactly —
scheme, host and port.

### 3. Replace the frontend's repository layer

Only `lib/controller/repositories/` and the config change. The Flutter app
already isolates all Supabase calls there, which is what makes this
contained:

| Replace | With |
|---|---|
| `SupabaseConfig` | `ApiConfig` holding the API base URL |
| `AuthRepository` | `http` calls to `/api/auth/*`, storing the token |
| `ProfileRepository` | `GET`/`PUT /api/profile` |
| `InsightsRepository` | `GET`/`PUT /api/insights` |
| `HabitRepository` | `GET`/`PUT /api/habits/today` |
| `QuestionnaireRepository` | `POST /api/questionnaire` |
| `ClinicRepository` | `GET /api/clinics` |

Models, cubits, screens, routing and widgets are untouched. `http` is already
a dependency.

Two behaviours need attention:

- **`onAuthStateChange`.** Supabase pushed auth changes as a stream, which
  `AuthCubit` listens to and `go_router` refreshes on. There is no server
  stream here. `AuthCubit` should call `GET /api/auth/me` once at start-up and
  emit state itself.
- **Token storage.** `shared_preferences` is `localStorage` on web, readable
  by any script on the page, so an XSS bug becomes account takeover. Acceptable
  for now, worth revisiting — see the frontend's `docs/API_MIGRATION.md`.

### 4. Migrate existing data (optional)

Only one real profile row exists on Supabase, so re-registering is probably
easier than migrating. If you do want to move it:

**Passwords cannot be migrated.** Supabase stores bcrypt hashes we never see,
and this API stores scrypt. Existing users have to reset their password or
re-register. There is no password reset flow yet
([ROADMAP.md](ROADMAP.md)), so for now: re-register.

Reference data needs no migration — `002_seed_reference_data.sql` already
contains the clinics and baselines exported from Supabase.

For user rows, export from the Supabase SQL editor:

```sql
SELECT json_agg(p) FROM profiles p;
```

Then, for each row, create the user with a temporary password via
`POST /api/auth/register` and `PUT` the profile with the exported fields.
Doing it through the API rather than raw SQL means the constraints and
validators apply.

### 5. Decommission Supabase

Only after the frontend is switched, deployed and verified:

- Remove `supabase_flutter` from `pubspec.yaml`
- Delete `lib/core/config/supabase_config.dart`
- Pause the Supabase project (keep it briefly, in case of rollback)
- Update the frontend docs, which currently describe Supabase throughout

## Rollback

Until step 5, rollback is reverting the frontend commit — Supabase stays
live and untouched the whole time. That is the reason for doing it in this
order.
