# MySihat — Backend

Node/TypeScript API on Vercel + Neon Postgres.

Frontend: [47--Frontend](https://github.com/Wahid-Islam/47--Frontend)

## Run

```powershell
cd backend
cp .env.example .env   # fill DATABASE_URL + JWT_SECRET
npm install
npm run dev
```

## Deploy

Push to `main`. Bundle with `npm run build:api` when changing `src/`.

Set on Vercel: `DATABASE_URL`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`.
