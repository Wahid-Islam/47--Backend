# Roadmap and known gaps

Ordered roughly by value per unit of effort.

## Blocking the frontend cutover

**Nothing is wired up yet.** The API is complete and tested, but the Flutter
app still talks to Supabase. Steps are in
[MIGRATION_FROM_SUPABASE.md](MIGRATION_FROM_SUPABASE.md).

**Not deployed or verified against real Neon.** The migrations and queries are
written against the schema exported from Supabase, and the unit tests cover
hashing, tokens and validation — but no query has run against the Neon
database yet, because the connection string was never available locally. First
real test: `npm run migrate` then `/api/health`.

## Auth gaps

**No password reset.** A user who forgets their password has no recovery path.
Needs an email sender, a single-use token table and an expiry. This is also
what blocks migrating existing Supabase users, whose bcrypt hashes cannot be
converted to scrypt.

**No email verification.** Anyone can register with an address they don't own.

**Tokens cannot be revoked individually.** Sessions are stateless, so a stolen
token stays valid until it expires and "sign out all devices" is impossible.
Rotating `JWT_SECRET` is the only lever, and it logs everyone out. Fixing this
properly means a `sessions` table and a lookup per request.

**No rate limiting.** `/api/auth/login` can be hit as fast as Vercel will
serve it. scrypt at ~100ms per attempt is a meaningful brake, but not a
substitute for a limiter — Vercel's firewall rules or a counter in Postgres
would both work.

## Testing

**No integration tests.** Everything currently tested is pure: hashing,
tokens, validators. Nothing exercises a real query, which is where the
ownership-filtering bugs would live. This needs a throwaway Neon branch (Neon
supports branching) and tests that register two users and assert neither can
read the other's data. That is the highest-value test suite this repo could
have.

**No CI.** Nothing runs `npm run typecheck` and `npm test` automatically.

## Operations

**Preview deployments share the production database.** Every pull request
preview reads and writes real user data. Neon branching plus a per-preview
`DATABASE_URL` would isolate them, and for health data this should happen
before the app has real users.

**Migrations are manual.** Deliberate — a schema change shouldn't be a side
effect of pushing code — but it does mean a deploy can reach a database that
hasn't been migrated. Worth a `/api/health` check that reports the latest
applied migration.

**No down-migrations.** Rolling back code is instant; rolling back schema is
not. Write additive migrations so an older deployment keeps working.

**No structured logging or error reporting.** Unexpected failures go to
`console.error` and are only visible in Vercel's log viewer.

## Data

**Baselines are not real DOSM figures.** `national_mortality_baselines` is
seeded with 24 "DOSM-inspired" rows. Replacing them with published statistics,
with citations, is what would make the national comparison defensible — and
it is the reason `GET /api/mortality-baselines` exists, so the numbers can be
corrected without shipping a new client.

**`questionnaire_responses` grows forever.** Append-only with no retention
policy and no deletion endpoint. Health data that accumulates indefinitely
needs a stated retention period.

**No account deletion.** Foreign keys cascade from `users`, so the SQL is
one line, but there is no endpoint. For health data this is close to a
requirement rather than a nice-to-have.

**Reference data lives in two places.** The Flutter app bundles its own copy
of the mortality curves so the risk engine works offline, and this database
has another. They can drift. Fixing it means either the client fetching them
at start-up with a cached fallback, or accepting the bundled copy as
authoritative and dropping the table.
