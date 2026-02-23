# Deployment

This monorepo runs locally with SQLite and is structured to move to Postgres in production.

## 1) Environment variables

Set at minimum:

- `DATABASE_URL`
  - Local SQLite: `file:./dev.db`
  - Production Postgres: `postgresql://user:password@host:5432/autonomous_football_league?schema=public`

Optional:

- `NODE_ENV=production`
- `NEXT_TELEMETRY_DISABLED=1`
- `ANTHROPIC_API_KEY` (optional, enables commissioner AI-assisted report/post content)
- `CLAUDE_MODEL` (optional, default `claude-3-5-sonnet-latest`)

## 2) Local verify flow

Run:

```bash
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

## 3) Production migration flow

Before first deploy:

```bash
corepack pnpm --filter @afl/db prisma:migrate:deploy
corepack pnpm db:seed
```

On each release, run migrations as part of deploy startup.

## 4) Hosting options

## Vercel (Next.js app)

1. Import repo into Vercel.
2. Set root to monorepo root.
3. Build command:
   - `corepack pnpm --filter @afl/web build`
4. Start command:
   - `corepack pnpm --filter @afl/web start`
5. Set `DATABASE_URL` in Vercel project settings.

## Railway / Fly / Supabase Postgres

1. Provision Postgres.
2. Copy connection URL into `DATABASE_URL`.
3. Run migration deploy command in release phase:
   - `corepack pnpm --filter @afl/db prisma:migrate:deploy`
4. Deploy web app with the same env.

## 5) Notes

- Agent submission artifacts are stored on local disk under `apps/web/.data/uploads/...` in v5.
- For stateless hosting, swap artifact storage to object storage (S3-compatible) using the storage abstraction in `apps/web/lib/submission-storage.ts`.
- Keep AI keys server-side only. Do not store provider keys in DB records or expose them to client routes.
