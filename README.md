# mysihat — Backend API

REST API for the [mysihat](https://github.com/Wahid-Islam/47--Frontend) health
app. Vercel serverless functions on top of **Neon Postgres**.

**Understand today. Act for tomorrow.**

## Why this exists

The Flutter frontend used to talk to Supabase directly. That was safe because
Supabase's anon key authorises nothing on its own — Postgres Row Level
Security did the enforcing, keyed to the signed-in user's JWT.

Neon is plain Postgres. Its `DATABASE_URL` is a full-privilege credential,
so it can never go near a browser bundle. This API is the trusted tier that
holds that credential, and it takes over the two jobs Supabase was doing for
free:

| Supabase did it with | This API does it with |
|---|---|
| Supabase Auth (`auth.users`, hashed passwords, sessions) | A `users` table, scrypt hashing, signed JWTs |
| Row Level Security on `auth.uid()` | Every user-scoped query filtered by the id in the verified token |

## Stack

| Piece | Choice | Why |
|---|---|---|
| Runtime | Vercel serverless functions, Node 20+ | Neon is provisioned through Vercel |
| Database driver | `@neondatabase/serverless` | Queries over HTTP, so there's no connection pool to warm per invocation |
| Language | TypeScript, strict | |
| Tokens | `jose`, HS256 | Works in both Node and edge runtimes |
| Password hashing | `node:crypto` scrypt | Memory-hard, and a built-in, so there's no native module to compile |
| Migrations | Plain SQL + `pg` | Readable, reviewable, no ORM to learn |
| Tests | `node:test` | Built in |

Two dependencies in production. That is deliberate for a service handling
health data.

## Quick start

```powershell
npm install
# Put Neon credentials + JWT_SECRET in .env (see .env.example)
npm run migrate          # creates tables, seeds clinics + baselines
npm run dev              # http://localhost:3000  (no vercel login needed)
```

```powershell
curl.exe http://localhost:3000/api/health
```

Expect `"database":"ok"`. Full run + deploy guide:
**[docs/HOW_TO_RUN_AND_DEPLOY.md](docs/HOW_TO_RUN_AND_DEPLOY.md)**.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | — | Liveness plus a real database round trip |
| `POST` | `/api/auth/register` | — | Create an account, returns a token |
| `POST` | `/api/auth/login` | — | Exchange credentials for a token |
| `POST` | `/api/auth/demo` | — | Sign in to the shared demo account |
| `GET` | `/api/auth/me` | Bearer | Restore a session |
| `GET`/`PUT` | `/api/profile` | Bearer | Read or replace the caller's profile |
| `GET`/`PUT` | `/api/insights` | Bearer | Read or store the caller's Health Age payload |
| `GET`/`PUT` | `/api/habits/today` | Bearer | Read or update a day's completed habits |
| `POST` | `/api/questionnaire` | Bearer | Append a questionnaire snapshot |
| `GET` | `/api/clinics` | — | Public clinic directory |
| `GET` | `/api/mortality-baselines` | — | Public baseline mortality rates |

Full request and response shapes: [docs/API.md](docs/API.md).

## One design decision worth knowing

**Responses use `snake_case` keys that mirror the old Supabase row shape.**
It looks unidiomatic for a JSON API, and it is on purpose: the Flutter models
already parse `full_name`, `activity_level` and `high_blood_pressure`, so the
frontend can switch from Supabase to this API by replacing its repository
layer and nothing else. No model, cubit, or widget changes.

**The risk engine is not here.** Health Age scoring stays on-device in Dart
so there is exactly one implementation. This API persists the result as
opaque `jsonb`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

```bash
npm run dev         # vercel dev, with functions on localhost:3000
npm run migrate     # apply pending migrations (idempotent)
npm run typecheck   # tsc --noEmit
npm test            # node:test
```

## Documentation

Start at [docs/README.md](docs/README.md).

| Doc | Covers |
|---|---|
| [docs/API.md](docs/API.md) | Every endpoint, request and response |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layering and request lifecycle |
| [docs/SCHEMA.md](docs/SCHEMA.md) | Tables, constraints, migrations |
| [docs/AUTH.md](docs/AUTH.md) | Password hashing and token design |
| [docs/SECURITY.md](docs/SECURITY.md) | What replaced RLS, and the rules that keep it working |
| [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md) | Environment setup and troubleshooting |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Shipping to Vercel |
| [docs/MIGRATION_FROM_SUPABASE.md](docs/MIGRATION_FROM_SUPABASE.md) | What changed, and how to move existing data |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Known gaps |

## Status

The API is live against Neon locally, and the Flutter frontend is wired to
it. Deploy steps: [docs/HOW_TO_RUN_AND_DEPLOY.md](docs/HOW_TO_RUN_AND_DEPLOY.md).
