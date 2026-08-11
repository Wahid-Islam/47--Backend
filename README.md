# MySihat — Backend

Node/TypeScript API on Vercel + Neon Postgres.

Frontend: [47--Frontend](https://github.com/Wahid-Islam/47--Frontend)

## Run

```powershell
cd backend
cp .env.example .env   # fill DATABASE_URL + JWT_SECRET
npm install
npm run migrate
npm run dev
```

## Deploy

Push to `main`. Vercel’s install step runs `npm run build:api` (bundles `src/` → `api/index.js`) so deploys stay in sync with TypeScript source.

Set on Vercel: `DATABASE_URL`, `JWT_SECRET`, and optionally `CORS_ALLOWED_ORIGINS`.

## Recommendations model

`GET /api/recommendations/rf` ranks daily habits with a Random Forest trained on **synthetic** teacher rules (`npm run train:rf`). It is a wellness prototype that approximates those rules — not a clinically validated model. `/api/recommendations/llm` is a deprecated alias of the same handler.
