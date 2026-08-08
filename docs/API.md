# API reference

Base URL is `/api`. All requests and responses are JSON.

## Conventions

**Keys are `snake_case`**, mirroring the Postgres column names and the shape
the old Supabase client returned. This is what lets the Flutter models parse
responses unchanged — see [MIGRATION_FROM_SUPABASE.md](MIGRATION_FROM_SUPABASE.md).

**Authentication** is a bearer token:

```
Authorization: Bearer <token>
```

**Errors** always have the same shape, with an optional `details`:

```json
{ "error": "\"age\" must be between 18 and 90" }
```

| Status | Meaning |
|---|---|
| `400` | Validation failed. The message names the offending field. |
| `401` | Missing, malformed, expired or tampered token; or wrong login credentials. |
| `404` | The resource does not exist. |
| `405` | Wrong HTTP method. The `Allow` header lists the valid ones. |
| `409` | Conflict, e.g. registering an email that is already taken. |
| `500` | Unexpected server fault. Never includes internal detail. |

**There are no `:id` parameters on user-scoped routes.** `/api/profile`
always means *the caller's* profile, resolved from the token. This is
structural, not a convention: there is no way to address another user's row.

---

## `GET /api/health`

No auth. Confirms the function is live *and* that Neon is reachable.

```json
{ "status": "ok", "database": "ok", "time": "2026-08-08T09:12:33.421Z" }
```

---

## `POST /api/auth/register`

No auth.

```json
{ "email": "lim@example.com", "password": "secret123", "full_name": "Lim Wei Jian" }
```

Creates the user and their profile row, then returns a session token so the
client doesn't need a second round trip to log in.

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "id": "9f1c...", "email": "lim@example.com" },
  "profile": { "id": "9f1c...", "full_name": "Lim Wei Jian", "age": 48, "...": "..." }
}
```

`409` if the email is already registered. Email matching is
case-insensitive, so `Lim@Example.com` and `lim@example.com` are one account.

---

## `POST /api/auth/login`

No auth.

```json
{ "email": "lim@example.com", "password": "secret123" }
```

Returns the same `{ token, user, profile }` shape as register.

`401` with **"Incorrect email or password"** for both an unknown email and a
wrong password. The messages are identical on purpose — distinguishing them
turns the login form into a tool for discovering which emails have accounts.

---

## `POST /api/auth/demo`

No auth, no body. Signs in to the shared demo account, creating it on first
use, and seeds the "Lim Wei Jian" profile. Returns `{ token, user, profile }`.

An already-customised demo profile (one where `onboarding_complete` is true)
is preserved rather than reset, so a walkthrough isn't wiped mid-demo.

This is a **shared public account**. Everyone who clicks "Try the demo" lands
in the same row, so it must never hold real personal data.

The response has no `insights`: scoring runs in the Flutter app, which calls
`PUT /api/insights` straight after.

---

## `GET /api/auth/me`

Bearer. Restores a session on app start-up — the replacement for Supabase's
`currentUser` and `onAuthStateChange`.

```json
{ "user": { "id": "9f1c...", "email": "lim@example.com" }, "profile": { "...": "..." } }
```

`profile` is `null` if the user somehow has no profile row. `404` if the
token is valid but the account has since been deleted.

---

## `GET /api/profile`

Bearer. Returns the caller's profile, or `null` if they have none yet.

```json
{
  "id": "9f1c...",
  "email": "lim@example.com",
  "full_name": "Lim Wei Jian",
  "age": 48,
  "gender": "male",
  "state": "Wilayah Persekutuan Kuala Lumpur",
  "activity_level": "low",
  "diet_habit": "unhealthy",
  "smoking": true,
  "bmi": 27.4,
  "high_blood_pressure": true,
  "onboarding_complete": true,
  "locale": "en",
  "active_action_ids": ["bp_screening", "walk_20", "swap_drinks"]
}
```

## `PUT /api/profile`

Bearer. Replaces the caller's profile. This is what the questionnaire
submits (US 1.1). All fields below are required.

| Field | Type | Accepted values |
|---|---|---|
| `full_name` | string | 1–120 characters |
| `age` | integer | 18–90 |
| `gender` | string | `male`, `female`, `other` |
| `state` | string | 1–120 characters |
| `activity_level` | string | `low`, `moderate`, `high` |
| `diet_habit` | string | `unhealthy`, `average`, `healthy` |
| `smoking` | boolean | |
| `bmi` | number | 10–60 |
| `high_blood_pressure` | boolean | |
| `onboarding_complete` | boolean | |
| `locale` | string | `en`, `bm` |
| `active_action_ids` | string[] | optional, defaults to `[]` |
| `email` | string | optional, defaults to the token's email |

An `id` in the body is **ignored**. The row written is always the caller's.

Returns the saved profile. These bounds are also `CHECK` constraints in
Postgres, so the database is the backstop if a validator is ever missed.

---

## `GET /api/insights`

Bearer. The caller's stored Health Age payload, or `null`.

```json
{
  "user_id": "9f1c...",
  "payload": { "healthAge": 54, "risks": [], "...": "..." },
  "generated_at": "2026-08-08T09:12:33.421Z"
}
```

## `PUT /api/insights`

Bearer.

```json
{ "payload": { "healthAge": 54, "...": "..." }, "generated_at": "2026-08-08T09:12:33.421Z" }
```

`generated_at` is optional and defaults to now.

`payload` is validated only as "an object". Its internal shape is owned by
the Flutter `Insights` model, and duplicating that contract here would
guarantee the two drift apart. Storing it as `jsonb` is also how the Epic 1.0
comparison fields were added without a migration.

---

## `GET /api/habits/today`

Bearer. Query: `date=YYYY-MM-DD`, optional, defaults to today in UTC.

Returns the day's log, **creating an empty one if it doesn't exist**, so the
client never has to handle a missing row.

```json
{
  "id": "3ab8...",
  "user_id": "9f1c...",
  "log_date": "2026-08-08",
  "completed_habit_ids": ["walk_20"]
}
```

## `PUT /api/habits/today`

Bearer.

```json
{ "date": "2026-08-08", "completed_habit_ids": ["walk_20", "swap_drinks"] }
```

Replaces the whole list rather than toggling one id, which keeps the endpoint
idempotent — retrying after a dropped connection can't double-toggle.

`date` is a parameter rather than being derived server-side because the
user's own calendar day is what matters, and only the client knows their
timezone.

---

## `POST /api/questionnaire`

Bearer.

```json
{ "answers": { "age": 48, "gender": "male", "smoking": true, "...": "..." } }
```

Appends one immutable snapshot (US 1.1) and returns `201`:

```json
{ "id": "7c2e...", "user_id": "9f1c...", "submitted_at": "2026-08-08T09:12:33.421Z" }
```

Insert-only. There is no update or delete, because the point of the table is
that historical answers are never overwritten — unlike the mutable profile.

---

## `GET /api/clinics`

No auth, matching the old Supabase policy that allowed anonymous reads. The
table holds no personal data, and the app shows clinics before sign-in.

```json
{
  "clinics": [
    {
      "id": "kk-bangsar",
      "name": "Klinik Kesihatan Bangsar",
      "state": "Wilayah Persekutuan Kuala Lumpur",
      "city": "Bangsar",
      "lat": 3.1319,
      "lng": 101.671,
      "services": ["blood_pressure", "blood_sugar", "general"]
    }
  ]
}
```

Distance ranking stays on the client, the only side that knows where the user
is.

---

## `GET /api/mortality-baselines`

No auth. Published population statistics.

```json
{
  "baselines": [
    {
      "cause_id": "cardiovascular",
      "cause_name": "Cardiovascular Disease",
      "cause_name_bm": "Penyakit Kardiovaskular",
      "gender": "male",
      "age_min": 40,
      "age_max": 49,
      "rate": 0.18,
      "source": "DOSM-inspired MVP baseline"
    }
  ]
}
```

The Flutter app currently uses its own bundled copy of these curves so the
risk engine works offline. This endpoint exists so the figures can be
corrected server-side without shipping a new client — see
[ROADMAP.md](ROADMAP.md).

---

## Typical client sequence

```
POST /api/auth/register       -> token
PUT  /api/profile             -> questionnaire answers (US 1.1)
POST /api/questionnaire       -> audit snapshot
                              [client computes Health Age locally]
PUT  /api/insights            -> persist the result
GET  /api/habits/today        -> today's habit checklist
```

On a later visit:

```
GET  /api/auth/me             -> restore session and profile
GET  /api/insights            -> stored Health Age
GET  /api/habits/today        -> today's checklist
```
