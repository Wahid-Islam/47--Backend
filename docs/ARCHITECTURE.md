# Architecture

```
api/                        One file per route (Vercel maps file -> URL)
  health.ts                 GET  /api/health
  auth/register.ts          POST /api/auth/register
  auth/login.ts             POST /api/auth/login
  auth/demo.ts              POST /api/auth/demo
  auth/me.ts                GET  /api/auth/me
  profile.ts                GET, PUT /api/profile
  insights.ts               GET, PUT /api/insights
  habits/today.ts           GET, PUT /api/habits/today
  questionnaire.ts          POST /api/questionnaire
  clinics.ts                GET  /api/clinics
  mortality-baselines.ts    GET  /api/mortality-baselines

src/
  env.ts                    Validated environment access
  db.ts                     Neon client + parameterised query helpers
  http.ts                   withRoute, HttpError, requireUser, CORS, jsonBody
  validation.ts             Field validators that throw 400s
  profileInput.ts           The one composite payload (the questionnaire)
  auth/
    password.ts             scrypt hashing and verification
    tokens.ts               JWT signing and verification
  repositories/             The only files containing SQL
    users.ts
    profiles.ts
    insights.ts
    habits.ts
    questionnaire.ts
    reference.ts            clinics + mortality baselines

migrations/                 Plain SQL, applied in filename order
scripts/migrate.ts          Migration runner
test/                       node:test unit tests
```

## Three layers

**Route handlers** (`api/`) do orchestration only: authenticate, validate,
call a repository, return. Each is small enough to read in one screen. They
contain no SQL.

**Repositories** (`src/repositories/`) are the only place SQL appears. Each
returns typed rows in the wire shape clients receive. Keeping SQL in one layer
is what makes "does any query forget to filter by user?" an answerable
question.

**Shared infrastructure** (`src/`) is everything cross-cutting.

## Request lifecycle

Every handler is wrapped in `withRoute(methods, handler)`, which:

1. Applies CORS headers for allow-listed origins
2. Answers `OPTIONS` preflight with `204`
3. Rejects methods outside the allow-list with `405` and an `Allow` header
4. Runs the handler and serialises its return value as JSON with `200`
5. Translates a thrown `HttpError` into its status and message
6. Translates anything else into a bare `500`, logging the real cause

So a handler is just: authenticate, validate, act, return. Failures are
`throw`, never a manually-built error response.

```ts
export default withRoute(['GET', 'PUT'], async (request) => {
  const { userId, email } = await requireUser(request);
  if (request.method === 'GET') return findProfile(userId);
  return upsertProfile(userId, parseProfileInput(jsonBody(request), email));
});
```

Handlers that need a non-200 status write the response themselves —
`POST /api/questionnaire` returns `201` that way — and `withRoute` notices
the response is already ended.

## Why GET and PUT share a file

Vercel routes by file path, so `api/profile.ts` is `/api/profile` for every
method. `withRoute` takes the allow-list and the handler branches on
`request.method`. Splitting into `profile-get.ts` and `profile-put.ts` would
mean two URLs.

## Database access

`src/db.ts` exposes `sql` (returns rows) and `sqlOne` (returns the first row
or `null`) as tagged templates over `@neondatabase/serverless`.

The driver queries Neon over **HTTP** rather than holding a TCP connection.
That is what makes it work in serverless: nothing to pool, nothing to close
when the invocation ends. The client is created lazily, so tests can import
repositories without a database.

The tagged template turns interpolations into `$1`, `$2` placeholders, so
values can never be parsed as SQL:

```ts
sql`SELECT * FROM users WHERE email = ${email}`
```

Two Postgres types need care, both handled in SQL rather than JavaScript:

- `numeric` comes back as a **string**, so `bmi` and `rate` are cast with
  `::float8`.
- `date` comes back as a JS `Date` in UTC, so `log_date` is formatted with
  `to_char(..., 'YYYY-MM-DD')` — converting in JS can shift the day by one
  across a timezone boundary.

## Concurrency

Serverless means many invocations at once, so read-then-write is unsafe.
Every create-if-missing is a single upsert relying on a unique constraint:

| Operation | Relies on |
|---|---|
| Register | `users_email_lower_key` with `ON CONFLICT DO NOTHING` |
| Get-or-create habit log | `habit_logs_user_date_key` |
| Save insights | `insights_user_id_key` |

## What deliberately isn't here

**The risk engine.** Health Age scoring stays in Dart
(`risk_engine.dart`) so there is exactly one implementation. Porting it here
would mean two versions of the same statistics drifting apart. The API treats
`insights.payload` as opaque `jsonb`.

**An ORM.** Six tables and a dozen queries do not need one, and plain SQL
keeps the migrations reviewable.

**A schema validation library.** There is one non-trivial payload. The
hand-written validators in `src/validation.ts` are smaller than the
dependency, which matters for a service handling health data.

## Dependencies

Two in production:

| Package | For |
|---|---|
| `@neondatabase/serverless` | Postgres over HTTP |
| `jose` | JWT signing and verification |

Password hashing uses `node:crypto`, so the most security-critical code has
no third-party dependency at all. `pg` is a dev dependency, used only by the
migration runner.
