# Deploying

The API is Vercel serverless functions. Every file in `api/` becomes a route,
so there is no build step and no server to keep running.

## First deploy

### 1. Link the project

```bash
npx vercel link
```

Neon (`neon-beige-pillow`) is already attached to your Vercel project, so
`DATABASE_URL` and the other `PG*` variables are injected automatically in
every environment. You do not set those by hand.

### 2. Add the variables Neon doesn't provide

```bash
# Generate a strong secret and add it to all environments
npx vercel env add JWT_SECRET production
npx vercel env add JWT_SECRET preview
npx vercel env add JWT_SECRET development

# The browser origins allowed to call the API
npx vercel env add CORS_ALLOWED_ORIGINS production
```

Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Use a **different** secret for production than for development. A leaked dev
secret must not be able to forge production sessions.

`CORS_ALLOWED_ORIGINS` in production is the deployed frontend origin, for
example `https://mysihat.web.app`. Comma-separate multiple origins. Never
`*` — the API returns data derived from a bearer token, and a wildcard would
let any site read it with a victim's credentials.

### 3. Run the migrations

Migrations do **not** run automatically on deploy. That is deliberate: a
schema change should be a decision, not a side effect of pushing code.

```bash
npx vercel env pull .env.production.local --environment=production
npm run migrate
```

Then delete `.env.production.local` — it holds a production credential.

### 4. Deploy

```bash
npx vercel --prod
```

### 5. Verify

```bash
curl https://<your-deployment>.vercel.app/api/health
```

`"database":"ok"` confirms the function can reach Neon. If it says
`unreachable`, `DATABASE_URL` isn't set in that environment.

## Subsequent deploys

Connect the GitHub repo in the Vercel dashboard and every push to `main`
deploys automatically, with pull requests getting preview URLs.

Preview deployments share the production Neon database unless you configure a
separate one. For a project storing health data that is worth fixing before
it matters — see [ROADMAP.md](ROADMAP.md).

## Pooled versus unpooled connections

| Variable | Use for |
|---|---|
| `DATABASE_URL` (pooled) | The API. Every function invocation is its own connection. |
| `DATABASE_URL_UNPOOLED` | Migrations only. DDL wants one stable session. |

Using the unpooled URL for request handling will exhaust Neon's connection
limit as soon as traffic arrives, because each concurrent invocation opens its
own connection.

## Runtime settings

`vercel.json` sets `maxDuration: 15` seconds. Requests are short — one or two
queries — but password hashing is intentionally ~100ms, so registration and
login are the slowest endpoints.

It also sets `Cache-Control: no-store` on everything under `/api/`, plus
`X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
Caching a response containing one user's health data on a shared CDN would be
a serious leak, so nothing here is cacheable.

## Rolling back

```bash
npx vercel rollback
```

Rolling back **code** is instant. Rolling back a **migration** is not —
there are no down-migrations. Write additive migrations (new nullable
columns, new tables) so an older deployment keeps working against a newer
schema.

## Checklist

- [ ] `JWT_SECRET` set in every environment, different per environment, ≥32 chars
- [ ] `CORS_ALLOWED_ORIGINS` lists only origins you control
- [ ] `npm run migrate` has run against the target database
- [ ] `/api/health` returns `"database":"ok"`
- [ ] No `.env.production.local` left on disk
- [ ] `npm run typecheck` and `npm test` clean
