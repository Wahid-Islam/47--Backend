# Backend documentation

Keep these current with the code. If you change behaviour, update the
relevant doc in the same change.

## Start here

| Doc | Covers |
|---|---|
| [LOCAL_DEV.md](LOCAL_DEV.md) | Getting it running: env vars, migrations, `curl` examples, troubleshooting |
| [API.md](API.md) | Every endpoint, request and response shape |

## Engineering

| Doc | Covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layering, request lifecycle, why the risk engine isn't here |
| [SCHEMA.md](SCHEMA.md) | Tables, constraints, migrations, Postgres type gotchas |
| [AUTH.md](AUTH.md) | scrypt hashing and JWT session design |
| [SECURITY.md](SECURITY.md) | **Read before touching `api/`.** What replaced RLS. |
| [DEPLOY.md](DEPLOY.md) | Shipping to Vercel, pooled vs unpooled connections |

## Migration

| Doc | Covers |
|---|---|
| [MIGRATION_FROM_SUPABASE.md](MIGRATION_FROM_SUPABASE.md) | What changed, and the frontend cutover steps |
| [ROADMAP.md](ROADMAP.md) | Known gaps |

## The two things to know before changing anything

**Identity comes from the verified token, never the request.** There is no
Row Level Security here, so a query that forgets to filter by the token's
`userId` exposes every user's health record. [SECURITY.md](SECURITY.md).

**Responses are `snake_case` on purpose.** They mirror the Supabase row shape
the Flutter models already parse, so the frontend cutover touches only its
repository layer. [API.md](API.md).

## Related

Frontend: <https://github.com/Wahid-Islam/47--Frontend>
