# Railway Worker Deployment

This repo uses two Railway services:

1. `afl-web` for Next.js web/API
2. `afl-worker` for continuous scheduled runbook execution

Both services point to the same repo and share the same `DATABASE_URL`.

## 1) Web service

Service settings:
- Start command: `pnpm start:web`
- Build command: `pnpm build`

Required variables:
- `DATABASE_URL` (Postgres connection string)
- `NODE_ENV=production`
- `PORT` (Railway injects automatically)

Optional:
- `ENABLE_EMBEDDED_AUTORUN_WORKER=false` (recommended when using dedicated worker)

## 2) Worker service

Create a second Railway service from the same repo.

Service settings:
- Start command: `pnpm start:worker`
- Build command: `pnpm build`

Required variables:
- `DATABASE_URL` (same Postgres as web)
- `NODE_ENV=production`

Optional worker tuning:
- `AFL_WORKER_POLL_MS=3000`
- `AFL_WORKER_RUNBOOK_TIMEOUT_MS=60000`

## 3) Scale guidance

- Keep worker replicas at `1` unless you intentionally want multi-instance scheduling.
- DB locking is implemented (`lockedAt`, `lockOwner`) to prevent duplicates.

## 4) Scheduler behavior

Worker loop:
- polls every few seconds
- scans leagues with `autoRunEnabled=true`
- selects due scheduled runbooks (`nextRunAt <= now`)
- atomically acquires lock
- writes `RunbookRun` + `EventLog` (`RUNBOOK_DUE`, `RUNBOOK_STARTED`, `RUNBOOK_COMPLETED`, `RUNBOOK_FAILED`)
- applies backoff on failure and clears stale locks

Safety limits:
- max 1 running runbook per league per worker process
- max 2 concurrent runbooks globally per worker process
- 60s hard timeout per runbook execution

## 5) First run checklist

1. Deploy web + worker services.
2. Open app and enable Auto-run on `/l/<slug>/dashboard`.
3. Enable scheduled runbooks in `/l/<slug>/runbooks` and set intervals.
4. Verify activity appears in `/l/<slug>/feed` without manual clicks.

## 6) Local parity

Run locally in two terminals:

Terminal 1:
```bash
pnpm dev
```

Terminal 2:
```bash
pnpm start:worker
```
