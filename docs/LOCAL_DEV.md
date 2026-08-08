# Local development

## Prerequisites

- Node 20 or newer (`node --version`). The tests and scripts use
  `--experimental-strip-types`, so TypeScript runs without a build step.
- The Vercel CLI, installed as a dev dependency. Use `npx vercel` if you
  don't have it globally.

## Setup

```bash
npm install
```

### 1. Get the Neon credentials

Never paste the connection string into a file by hand or into a chat. Pull it
from Vercel:

```bash
npx vercel link            # once, to connect this folder to the Vercel project
npx vercel env pull .env.development.local
```

That writes `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and the other `PG*`
variables Neon exposes. The file is gitignored.

### 2. Add a JWT secret

`vercel env pull` won't include this until you add it in Vercel, so generate
one and append it to `.env.development.local`:

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))" >> .env.development.local
```

Also add the browser origins allowed to call the API:

```
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:8081
```

See `.env.example` for every variable and what it does.

### 3. Create the tables

```bash
npm run migrate
```

Idempotent, so it is safe to re-run. Expect:

```
  apply  001_initial_schema.sql ... done
  apply  002_seed_reference_data.sql ... done

Applied 2 migration(s).
```

### 4. Run it

```bash
npm run dev
```

`vercel dev` serves the functions on <http://localhost:3000>, mapping each
file in `api/` to a route.

```bash
curl http://localhost:3000/api/health
```

`{"status":"ok","database":"ok",...}` means Neon is reachable.

## Trying the API

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"secret123","full_name":"Your Name"}'

# Keep the token from the response
TOKEN='paste-it-here'

# Read your profile
curl http://localhost:3000/api/profile -H "Authorization: Bearer $TOKEN"

# Submit questionnaire answers
curl -X PUT http://localhost:3000/api/profile \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"full_name":"Your Name","age":48,"gender":"male","state":"Melaka",
       "activity_level":"low","diet_habit":"unhealthy","smoking":true,
       "bmi":27.4,"high_blood_pressure":true,"onboarding_complete":true,
       "locale":"en","active_action_ids":[]}'

# Public, no token
curl http://localhost:3000/api/clinics
```

On PowerShell, use `curl.exe` (bare `curl` is an alias for
`Invoke-WebRequest` and takes different arguments).

## Checks

```bash
npm run typecheck
npm test
```

Both should be clean before you push. There is no CI yet — see
[ROADMAP.md](ROADMAP.md).

## Connecting the Flutter app

The frontend still runs on Supabase, so nothing is wired up yet. When you do
the cutover, add whatever origin `flutter run -d chrome` prints to
`CORS_ALLOWED_ORIGINS`. The port changes every run, which is the usual cause
of a CORS failure in development. Steps are in
[MIGRATION_FROM_SUPABASE.md](MIGRATION_FROM_SUPABASE.md).

## Troubleshooting

**`Missing required environment variable DATABASE_URL`** — the env file wasn't
loaded. `npm run migrate` reads `.env.development.local` via
`--env-file-if-exists`; `vercel dev` picks it up automatically. Check the file
exists and the name is exact.

**`JWT_SECRET must be at least 32 characters long`** — intentional. A short
HS256 key is brute-forceable, and forging it means forging sessions.

**`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`** — Node's type stripping only erases
types; it cannot handle syntax that needs code generated. Avoid `enum`,
`namespace`, and constructor parameter properties
(`constructor(private readonly x: T)`). Write the field out explicitly, as
`HttpError` does.

**CORS errors in the browser** — the origin isn't in
`CORS_ALLOWED_ORIGINS`. It must match scheme, host *and* port exactly.
`localhost` and `127.0.0.1` are different origins.

**`too many connections`** — something is using `DATABASE_URL_UNPOOLED` for
request handling. The API must use the pooled URL; only migrations use the
unpooled one.
