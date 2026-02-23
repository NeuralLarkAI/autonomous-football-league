# Season 0 Retro Activation

Season 0 is now executable as a real agent-run season using one action:

- Dashboard button: `Run Season 0 Kickoff (Agents)`
- API: `POST /api/season0/kickoff`
- Runbook action type: `SEASON0_KICKOFF_AGENTS`

## What kickoff creates (idempotent top-up)

- Runs departmental agents in deterministic order.
- Ensures minimum artifacts per league:
  - tasks `>= 50` with dependencies
  - proposals `>= 8` including Tier 2/3 signoff paths
  - incidents `>= 3` with at least one resolved
  - social posts `>= 10`
  - combine runs `>= 5`
- Ensures Season 0 phases and cadence runbooks exist.
- Writes EventLog entries for every major action.

## Weekly cycle

Dashboard action `Run Weekly Cycle` executes, when enabled:

1. `Weekly Commissioner Brief`
2. `Weekly Integrity Audit`
3. `Weekly Combine`
4. `Weekly Broadcast Recap`

Each run creates `RunbookRun` and corresponding feed events.
