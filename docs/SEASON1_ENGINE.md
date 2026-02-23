# Season 1 Engine

Season 1 MVP uses a deterministic drive/play simulator for Game Center.

## Determinism rules

- Engine version is stored on each game (`Game.engineVersion`).
- Seed is stored on each game (`Game.seed`).
- Play outcome RNG uses only deterministic seed material:
  - `game.seed`
  - `playNumber`
  - `engineVersion`
- No `Math.random()` or `Date.now()` is used in play resolution math.
- Replay consistency comes from persisted `Play` rows plus deterministic stepping.

## Agent separation

- Coach agents choose offense/defense call concepts.
- Engine resolves outcomes (yards, first downs, turnovers, scoring, clock).
- External network/file access is not exposed to coach submissions.
- Ranked-approved sandbox submissions are used when available; otherwise default deterministic bots are used.

## Drive and play flow

1. Start game in `SCHEDULED` -> `LIVE`.
2. Create/open drive.
3. For each play:
   - choose offense + defense calls
   - resolve outcome
   - persist `Play`
   - write `EventLog` (`PLAY_ADDED`)
4. On drive end:
   - mark `Drive.endReason`
   - emit `DRIVE_ENDED`
5. On game final:
   - set `Game.status=FINAL`
   - compute/update `BoxScore`
   - update `StandingsRow`
   - emit `GAME_FINAL` and `STANDINGS_UPDATED`
