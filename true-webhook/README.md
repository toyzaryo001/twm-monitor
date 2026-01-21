# True Webhook (Next.js + Express + Prisma)

Single-process deployment: one Express server hosts both the Next.js UI and the REST API.

## Local dev

1) Create `.env` from `.env.example` and set `DATABASE_URL`.

2) Install deps and run DB migrations:

```bash
npm install
npm run prisma:migrate
```

3) Start:

```bash
npm run dev
```

Health check: `GET http://localhost:3000/api/health`

## API

- `GET /api/health`
- `GET /api/version`
- `GET /api/accounts`
- `POST /api/accounts`
- `POST /api/telegram/test`

## Railway deploy (GitHub)

Recommended:

1) Push repo to GitHub.
2) In Railway: New Project → Deploy from GitHub repo.
3) Add a Postgres database and copy its `DATABASE_URL` into Railway Variables.
4) Railway will run `npm run build` and start using the `Procfile` (`npm run start:railway`).

Healthcheck path: `/api/health`

## Cloudflare DNS

Point your domain/subdomain to the Railway service domain:

- Add a `CNAME` record (e.g. `api` → `<your-railway-domain>`)
- Start with DNS-only (grey cloud) until everything works, then enable proxy if desired.
