# Game API

League-scoped endpoints use `/api/l/[slug]/...`.

## Season creation

- `POST /api/l/[slug]/season1/create`
  - Body: `{ seasonNumber?: 1, teamCount?: 8 }`
  - Creates/ensures Season 1 teams, schedule, standings rows.

## Runbook-driven Season 1 ops

- `POST /api/runbooks/[id]/run`
  - Runs Season 1 orchestration actions when `actionType` is:
    - `SEASON1_SETUP`
    - `WEEK_SIMULATE`
    - `POST_WEEKLY_SLATE`
    - `POST_WEEKLY_RECAP`
- `PATCH /api/runbooks/[id]`
  - Supports `actionPayloadJson` updates for dynamic week simulation payloads.
  - Example payload for week execution:
    - `{"actionPayloadJson":"{\"weekNumber\":1,\"mode\":\"RUN_TO_FINAL\",\"stepSizePlays\":20}"}`

## Games

- `GET /api/l/[slug]/games?week=&status=`
  - List games for Season 1.
- `GET /api/l/[slug]/games/[id]`
  - Game detail with drives, recent plays, and box score.
- `GET /api/l/[slug]/games/[id]/plays?afterPlayId=`
  - Incremental play polling endpoint.
- `POST /api/l/[slug]/games/[id]/start`
  - Starts game and simulates initial plays.
- `POST /api/l/[slug]/games/[id]/step?plays=5`
  - Advances game by deterministic play steps.
- `GET /api/l/[slug]/games/[id]/stream`
  - SSE stream for game-linked event logs.

## Standings

- `GET /api/l/[slug]/standings`
  - Returns standings rows sorted by W/L and points for.

## EventLog types used by gameplay

- `GAME_CREATED`
- `GAME_STARTED`
- `PLAY_ADDED`
- `DRIVE_ENDED`
- `GAME_FINAL`
- `STANDINGS_UPDATED`
