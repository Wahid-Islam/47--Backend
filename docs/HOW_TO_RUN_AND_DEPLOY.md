# How to run and deploy mysihat

You have three pieces:

| Piece | Where | Role |
|---|---|---|
| **Database** | Neon Postgres (Vercel Storage `neon-beige-pillow`) | Stores users, profiles, insights, habits, clinics |
| **Backend** | `backend/` → [47--Backend](https://github.com/Wahid-Islam/47--Backend) | Auth + REST API |
| **Frontend** | `frontend/` → [47--Frontend](https://github.com/Wahid-Islam/47--Frontend) | Flutter web app |

The Flutter app talks to the backend API. The backend talks to Neon. The browser never sees the database password.

---

## Run locally

### 1. Backend (terminal A)

```powershell
cd D:\S2-2026\W1-W3\backend
npm install
npm run migrate          # only needed once (or after new SQL files)
npm run dev
```

You should see:

```
mysihat API listening on http://localhost:3000
```

Check it:

```powershell
curl.exe http://localhost:3000/api/health
```

Expect `"status":"ok","database":"ok"`.

Keep this terminal open.

### 2. Frontend (terminal B)

```powershell
cd D:\S2-2026\W1-W3\frontend
flutter pub get
flutter run -d chrome
```

The app defaults to `http://localhost:3000`. To point at another API URL:

```powershell
flutter run -d chrome --dart-define=API_BASE_URL=https://your-api.vercel.app
```

### 3. Try the app

1. Open the landing page
2. Click **Try demo** — loads Lim Wei Jian with Health Age insights
3. Or **Register** → complete the questionnaire → Personal Insights → Action Roadmap

---

## Deploy online

### A. Deploy the backend (Vercel)

1. Go to [vercel.com](https://vercel.com) and import **`Wahid-Islam/47--Backend`**
2. Neon is already attached as Vercel Storage, so `DATABASE_URL` is injected automatically
3. Add these environment variables in the Vercel project settings (all environments):

   | Name | Value |
   |---|---|
   | `JWT_SECRET` | Generate with: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` — use a **different** secret from local `.env` |
   | `CORS_ALLOWED_ORIGINS` | Your frontend URL, e.g. `https://your-frontend.vercel.app` (comma-separate if you have more than one) |
   | `JWT_EXPIRES_IN` | `7d` (optional) |

4. Deploy. Copy the API URL, e.g. `https://47-backend.vercel.app`
5. Run migrations **once** against production Neon:

   ```powershell
   cd D:\S2-2026\W1-W3\backend
   npx vercel env pull .env.production.local --environment=production
   # temporarily point migrate at production:
   Copy-Item .env.production.local .env -Force
   npm run migrate
   # restore your local .env afterwards
   ```

6. Verify: `curl.exe https://YOUR-API.vercel.app/api/health`

### B. Deploy the frontend (Vercel or Firebase)

Build the Flutter web bundle pointed at the **deployed** API:

```powershell
cd D:\S2-2026\W1-W3\frontend
flutter build web --release --dart-define=API_BASE_URL=https://YOUR-API.vercel.app
```

#### Option 1 — Vercel (static)

1. Import **`Wahid-Islam/47--Frontend`** into Vercel
2. Set build settings:
   - **Build Command:** install Flutter in the build, then  
     `flutter build web --release --dart-define=API_BASE_URL=https://YOUR-API.vercel.app`
   - **Output Directory:** `build/web`
3. Or build locally and deploy the `build/web` folder with `npx vercel --prod`
4. Add the frontend origin to the backend’s `CORS_ALLOWED_ORIGINS`, then redeploy the backend

#### Option 2 — Firebase Hosting

```powershell
cd D:\S2-2026\W1-W3\frontend
flutter build web --release --dart-define=API_BASE_URL=https://YOUR-API.vercel.app
firebase deploy --only hosting
```

`firebase.json` already serves `build/web` with SPA rewrites.

### C. Final checklist

- [ ] `/api/health` returns `"database":"ok"` on the production API
- [ ] Frontend was built with the production `API_BASE_URL`
- [ ] Backend `CORS_ALLOWED_ORIGINS` includes the exact frontend origin (`https://…`, no trailing slash)
- [ ] You can register, complete the questionnaire, and see Personal Insights online
- [ ] Demo login still works

---

## Useful commands

```powershell
# Backend
cd D:\S2-2026\W1-W3\backend
npm run migrate      # apply SQL
npm run smoke        # quick Neon connectivity check
npm run typecheck
npm test
npm run dev          # http://localhost:3000

# Frontend
cd D:\S2-2026\W1-W3\frontend
flutter analyze
flutter test
flutter run -d chrome
flutter build web --release --dart-define=API_BASE_URL=https://YOUR-API.vercel.app
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend: “Cannot reach the API…” | Backend not running, or wrong `API_BASE_URL` |
| Browser CORS error | Add the Flutter origin to `CORS_ALLOWED_ORIGINS` (local `localhost` is auto-allowed in non-production) |
| `/api/health` database unreachable | Check `DATABASE_URL` in `.env` / Vercel env |
| Login works locally but not online | Production missing `JWT_SECRET`, or frontend still pointing at `localhost:3000` |
