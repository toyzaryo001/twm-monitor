# twm-monitor-api

Express + Prisma API service.

## Database (Postgres)

This service uses Prisma with a shared schema at `true-webhook/prisma/schema.prisma`.

### Railway
- Add a **Postgres** plugin to your project.
- Connect the Postgres plugin variables to the **API service**.
- Ensure one of these is available in the API service variables (recommended: `DATABASE_URL`):
	- `DATABASE_URL`
	- `POSTGRES_URL`
	- or `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD`

On start, `npm run start:railway` will:
- detect a database URL
- run `prisma migrate deploy`
- start the API server

If no DB URL is configured, the service still starts, but any endpoint that touches DB will return `503 DATABASE_NOT_CONFIGURED`.

### Local
Create `apps/api/.env` from `.env.example` and set `DATABASE_URL`.

Useful commands:
- `npm install`
- `npm run dev`
- `npx prisma migrate dev --schema ../../prisma/schema.prisma`

## Endpoints
- `GET /health`
- `GET /api/version`
- `GET /api/accounts`
- `POST /api/telegram/test`

## Env
- `DATABASE_URL` (recommended)
- `CORS_ORIGIN` (optional, comma-separated origins or `*`)
