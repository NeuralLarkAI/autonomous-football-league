# Auto-run Scheduler

This project supports league-scoped automatic runbook execution.

## Overview

When `autoRunEnabled=true` for a league, a singleton scheduler loop in the web server process:

- polls every 2 seconds
- finds due scheduled runbooks (`triggerType=SCHEDULED`, `isEnabled=true`, `nextRunAt <= now`)
- acquires a DB lock per runbook (`lockedAt`, `lockOwner`) before execution
- executes runbook actions
- writes `RunbookRun` rows and `EventLog` records
- schedules the next run using `intervalSeconds`

The scheduler is database-driven and works in local dev and Codespaces without external services.

## Locking and safety

- stale lock timeout: 2 minutes
- max 1 active runbook per league
- max 2 active runbooks globally per process
- failure backoff: `nextRunAt = now + min(interval * 2^failureCount, 3600)`
- success resets `failureCount` to `0`

## Event types emitted

- `RUNBOOK_DUE`
- `RUNBOOK_STARTED`
- `RUNBOOK_COMPLETED`
- `RUNBOOK_FAILED`
- `AUTORUN_ENABLED`
- `AUTORUN_DISABLED`

## API

### Toggle auto-run

`POST /api/l/[slug]/autorun`

Body:

```json
{ "enabled": true }
```

When enabling, scheduled enabled runbooks with `nextRunAt=null` are initialized.

### Upcoming scheduled runs

`GET /api/l/[slug]/runbooks/next`

Returns next scheduled runbooks with timing/failure metadata.

## UI

- Dashboard:
  - Auto-run toggle
  - Upcoming runs widget
  - Run due now shortcut
- Runbooks page:
  - edit interval for scheduled interval runbooks
  - view `nextRunAt`, `lastRunAt`, `failureCount`

## Local verification

```bash
pnpm db:migrate
pnpm seed
pnpm dev
```

1. Open `/l/<slug>/dashboard`
2. Toggle Auto-run ON
3. Wait 1-2 minutes and confirm new runbook events in `/l/<slug>/feed`
4. Toggle Auto-run OFF and confirm no new automatic runs are created
