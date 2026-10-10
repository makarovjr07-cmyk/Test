# Kankai Secondary School Result Portal

Express + EJS result portal with a MongoDB backend and static public pages.

## Requirements
- Node.js 24.13.1, npm 11.19.0
- MongoDB connection string (Atlas or self-hosted)

## Setup
1. Create a `.env` file and fill every value needed by the app.
2. Install deps: `npm install`.
3. Local dev (single process): `npm run start:single` or `npm run dev` (nodemon).
4. Production: `npm start` (uses `backend/cluster.js`; set `WEB_CONCURRENCY` as needed).

## Key Environment Variables
- `MONGODB_URI` (required): primary Mongo connection string.
- `MONGODB_URI_FALLBACK` (optional): fallback direct URI.
- `MONGODB_DB_NAME`: database name (default `kankai_result_db`).
- `SESSION_SECRET` (required): unique random string for cookies (use at least 32 random bytes).
- `SESSION_MAX_AGE_MS`: session lifetime in ms (default 30 minutes).
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` (required): bootstrap admin; set `ADMIN_SEED_ENABLED=false` after first run if desired.
- `CLEAR_DB_SECRET` (required): unique password for the "Clear Database" admin action; do not reuse the admin password.
- `ADMIN_PASSWORD_HASH_ROUNDS`: bcrypt work factor, default `12` (raise carefully because it increases login CPU time).
- `WEB_CONCURRENCY`: worker count for `cluster.js` (keep 1 on small plans).
- `PORT`, `HOST`, `NODE_ENV`, `MONGO_*`, and `STORAGE_DIR`: runtime and deployment knobs.

## Deployment (Railway)
- Install command: `npm install`.
- Start command: `npm start`.
- Set `NODE_ENV=production`, `SESSION_SECRET`, `MONGODB_URI`, `ADMIN_*`, and `CLEAR_DB_SECRET`. Railway reads the required Node and npm versions from `package.json`; use the included `.nvmrc` locally. Serve the site through HTTPS only.
- Add a persistent Railway Volume mounted at `/app/storage` and set `STORAGE_DIR=/app/storage`. The app creates its `data/` and `photos/` folders there; without a persistent volume, uploaded files may be lost on redeploy.
- Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` if the site should email admission notifications.
- Recommended: `WEB_CONCURRENCY=1` unless you intentionally scale workers; session store already uses MongoDB.
- Set the Railway health-check path to `/health`. It returns `200` only after MongoDB is connected.
- Before going live, allow the deployment environment to access the MongoDB cluster and confirm `/health`, `/`, `/result`, and `/admin/login` load over HTTPS.

## Notes
- Default credentials have been removed; all secrets must be provided via env vars.
- Sessions now persist in MongoDB, so clustered workers stay in sync.
- Static pages (`index.html`, `about.html`, `gallery.html`, etc.), `styles.css`, `script.js`, and public images live in `frontend/`.
- Backend-managed JSON data such as `teachers.json` lives in `backend/data/`.
- Runtime-managed uploads, gallery state, and mirrored media are stored under `storage/` or `STORAGE_DIR` and should stay out of git.
