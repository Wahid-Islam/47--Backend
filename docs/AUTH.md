# Authentication

Supabase Auth handled accounts, password storage and sessions. Neon is plain
Postgres, so this API owns all three.

## Accounts

The `users` table holds `id`, `email` and `password_hash`. `profiles.id`
references `users.id`, so a profile is always tied to a real account and
deleting the user cascades.

Email uniqueness is enforced by a unique index on `lower(email)`, not on
`email`, so `Lim@Example.com` and `lim@example.com` cannot both register.
Registration uses `ON CONFLICT (lower(email)) DO NOTHING ... RETURNING`,
which makes the check atomic — two simultaneous signups for the same address
cannot both succeed, whereas a "does it exist? then insert" sequence would
let them.

## Password hashing: scrypt

`src/auth/password.ts`, using `node:crypto`.

**Why scrypt and not bcrypt.** bcrypt means a native module, which has to
compile in the build image and is a recurring source of serverless
deployment failures. scrypt is a Node built-in, is memory-hard (so it
resists GPU cracking better than bcrypt), and is what Node's own crypto
documentation recommends for password storage. Zero dependencies for the most
security-critical code in the service.

**Cost parameters:** `N=32768, r=8, p=1`, a 16-byte random salt and a 64-byte
derived key. `maxmem` is raised to 128MB because `N*r*128` exceeds the 32MB
default. That lands around 100ms per hash on typical serverless hardware:
expensive enough to make offline brute force costly, cheap enough to stay
well inside a function's time budget.

**Hash format** is self-describing:

```
scrypt$32768$8$1$<salt-base64url>$<hash-base64url>
```

Storing the parameters means the cost can be raised later without
invalidating existing passwords — read the parameters from the stored hash to
verify, and re-hash with the new cost on next successful login.

**Verification** derives a key with the stored parameters and compares with
`timingSafeEqual`.

## Sessions: JWT

`src/auth/tokens.ts`, using `jose` with HS256.

| Claim | Value |
|---|---|
| `sub` | the user's id — the only identity the API trusts |
| `email` | convenience, so `/api/profile` can default the email |
| `iss` | `mysihat-api` |
| `aud` | `mysihat-app` |
| `iat` / `exp` | issued-at and expiry, from `JWT_EXPIRES_IN` (default `7d`) |

Verification pins `algorithms: ['HS256']`. This matters: without it, a
crafted token could declare `"alg": "none"` and skip signature verification
entirely — a classic JWT vulnerability. `iss` and `aud` are checked too, so a
token minted by some other service sharing the secret is rejected.

`verifySessionToken` returns `null` for anything wrong — bad signature,
expiry, wrong audience, malformed input — rather than throwing, so routes
have one path for "not authenticated".

## Why stateless tokens

There is no sessions table, which means:

- **No database round trip to authorise a request.** Signature verification
  is local, which suits per-request serverless billing.
- **Tokens cannot be revoked individually.** A stolen token stays valid until
  it expires. Rotating `JWT_SECRET` is the blunt instrument that invalidates
  everything at once.
- **Claims can go stale.** The `email` in a token reflects the moment it was
  issued.

For this app that trade is reasonable. If individual revocation or "sign out
all devices" is needed, that means a `sessions` table and a lookup per
request — tracked in [ROADMAP.md](ROADMAP.md).

## How the client uses it

```
POST /api/auth/login  ->  { token, user, profile }
```

The client stores the token and sends it on every subsequent request:

```
Authorization: Bearer <token>
```

On start-up it calls `GET /api/auth/me` to restore the session. If that
returns `401`, the token is gone or expired and the user is signed out.

**Storage on web is the client's decision, and it is a real one.**
`localStorage` is readable by any script on the page, so an XSS bug becomes
account takeover; an httpOnly cookie is not, but needs CSRF protection. The
Flutter app currently persists via `shared_preferences`, which is
`localStorage` on web. See the frontend's `docs/API_MIGRATION.md`.

## Tokens are not a substitute for authorisation

A valid token proves *who* the caller is. It says nothing about *what* they
may touch. Every user-scoped query must still filter on the token's `userId`
— see [SECURITY.md](SECURITY.md).

## Tests

`test/password.test.ts` covers correct and wrong passwords, per-password
salting, recorded parameters, and malformed hashes returning `false`.

`test/tokens.test.ts` covers the round trip, a **tampered payload reusing the
original signature**, a token signed with a different secret, expiry, and
bearer header parsing.
