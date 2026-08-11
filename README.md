# MySihat backend

Node/TypeScript REST API for MySihat. It runs on Vercel serverless functions and stores data in Neon Postgres.

Frontend: [47--Frontend](https://github.com/Wahid-Islam/47--Frontend)

## What the API covers

Auth (register, login, demo), profile, questionnaire audit rows, insights payloads, today’s habit log, clinic list helpers, and habit recommendations. Session tokens are JWTs. Profile fields such as BMI are derived on the server from height and weight. Questionnaire submit also updates the saved profile so recommendations read one consistent health record.

The demo account is a shared user. Each demo login resets that profile, today’s habits, and insights to seed data so visitors do not keep each other’s edits for long.

## Run locally

```powershell
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

Fill `DATABASE_URL` and `JWT_SECRET` (at least 32 characters) in `.env`. Optional: `DATABASE_URL_UNPOOLED` for migrations, `CORS_ALLOWED_ORIGINS` for extra allowed frontends, `JWT_EXPIRES_IN`.

Useful scripts: `npm test`, `npm run typecheck`, `npm run build:api`, `npm run smoke`.

## Deploy

Push to `main`. Vercel’s install step runs `npm run build:api`, which bundles `src/` into `api/index.js`. Set `DATABASE_URL`, `JWT_SECRET`, and optionally `CORS_ALLOWED_ORIGINS` in the Vercel project env.

## Recommendations model

`GET /api/recommendations/rf` ranks a short list of daily habits with a Random Forest. The forest is trained with `npm run train:rf` on synthetic profiles labelled by hard coded teacher rules. Reported accuracy is agreement with that teacher, not clinical validation. Treat it as a wellness prototype.

`/api/recommendations/llm` is an old alias of the same handler and should not be described as a generative model.
