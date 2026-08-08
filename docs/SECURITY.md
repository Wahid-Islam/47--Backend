# Security

This service holds health data and the only credential that can reach the
database. Read this before changing anything under `api/`.

## The one rule

**Identity comes from the verified token, never from the request.**

```ts
const { userId } = await requireUser(request);   // correct
const userId = request.body.user_id;             // catastrophic
```

Every user-scoped query filters on that `userId`. This is what replaced
Supabase's Row Level Security, and unlike RLS it is not enforced by the
database — it is enforced by remembering to do it. A single endpoint that
takes a user id from the body or the query string hands every user's health
record to anyone who can guess an id.

Two structural habits keep that honest:

- **No `:id` on user-scoped routes.** `/api/profile` means the caller's
  profile. There is deliberately no `/api/profile/:id` to get wrong.
- **`parseProfileInput` discards any `id` in the body**, so even a client
  that sends one cannot redirect the write.

## Why there is no RLS

RLS worked on Supabase because each browser connected *as the end user*, and
`auth.uid()` resolved from their JWT inside Postgres.

Here, the API connects with one privileged Neon role for every request.
`auth.uid()` has no meaning, so an RLS policy would either block everything
or allow everything. Enabling RLS would be security theatre — it is left off,
and the enforcement is in the API, on purpose.

## Secrets

| Secret | Where it lives | If it leaks |
|---|---|---|
| `DATABASE_URL` | Vercel env vars only | Full read/write on all user data |
| `JWT_SECRET` | Vercel env vars only | Anyone can mint a valid token for any user |

Neither may appear in the repository, in client code, in logs, or in an error
response. `.gitignore` excludes every `.env*` except `.env.example`.

`JWT_SECRET` is rejected at start-up if it is shorter than 32 characters,
because a short HS256 key is brute-forceable — and forging that key means
forging sessions.

Rotating `JWT_SECRET` invalidates every live session, logging everyone out.
That is the correct response to a suspected leak.

## Passwords

scrypt from `node:crypto`, with `N=32768, r=8, p=1` and a random 16-byte
salt per password. See [AUTH.md](AUTH.md) for why scrypt and not bcrypt.

- Verification uses `timingSafeEqual`. A byte-by-byte `===` leaks how many
  leading bytes matched through response timing.
- Parameters are stored in the hash string, so the cost can be raised later
  without invalidating existing passwords.
- A malformed hash returns `false` rather than throwing, so a corrupt row
  fails the login instead of producing a 500 that confirms the account
  exists.
- Passwords are capped at 200 characters, so a megabyte of input can't be
  used to burn server CPU.

## Not leaking who has an account

`POST /api/auth/login` answers `401 "Incorrect email or password"` for both
an unknown email and a wrong password. Different messages would let anyone
enumerate which emails are registered — which, for a health app, reveals
something about a person by itself.

`POST /api/auth/register` unavoidably reveals it, since the form has to
explain why signup failed. That is an accepted trade-off.

## SQL injection

All queries go through the tagged template in `src/db.ts`, which turns
interpolations into `$1`, `$2` placeholders. User input can never be parsed
as SQL.

```ts
sql`SELECT * FROM users WHERE email = ${email}`      // parameterised
sql(`SELECT * FROM users WHERE email = '${email}'`)  // never do this
```

Column and table names cannot be parameterised, so they are always written
literally in the query and never taken from input.

## CORS

The allow-list comes from `CORS_ALLOWED_ORIGINS`. It is not `*`, because the
API serves responses derived from a bearer token and a wildcard would let any
website read them using a victim's credentials.

Adding an origin means adding a site that can act on behalf of your users.
Treat it as a security change.

## Error responses

`withRoute` catches everything. Unexpected failures are logged server-side
and answered with a bare `500 "Internal server error"` — driver errors and
stack traces would otherwise disclose table names, column names and query
structure.

## The demo account

`POST /api/auth/demo` signs anyone into a **shared account** with a fixed
password. Anyone who has ever clicked "Try the demo" can read and write that
row. It must never contain real personal data. This is inherited from the
Supabase implementation and is a product decision, not an oversight.

## Data minimisation

- The risk engine runs on-device. Questionnaire answers are scored in the
  browser; only the profile and the resulting insights are persisted.
- There is no analytics or third-party telemetry. Adding any would mean
  health-adjacent data leaving the user's browser and needs a deliberate
  decision.
- `questionnaire_responses` is an append-only audit trail. It grows forever
  and there is no deletion endpoint yet — see [ROADMAP.md](ROADMAP.md).

## Checklist for a new endpoint

- [ ] Calls `requireUser` unless the data is genuinely public
- [ ] Filters every query by the token's `userId`
- [ ] Takes no user id from the body, query, or path
- [ ] Validates every input with `src/validation.ts`
- [ ] Throws `HttpError`, never returns a raw driver error
- [ ] Parameterises all values in SQL
- [ ] Has a test for the rejection cases, not just the happy path
