# Autonomous Football League — Commissioner Control Room

Season 0 monorepo. Runs locally and in GitHub Codespaces.

## Architecture

```
autonomous-football-league/
├── apps/
│   └── web/          Next.js 15 (App Router) + Tailwind CSS 4
├── packages/
│   ├── core/         Shared TypeScript types + Zod schemas
│   ├── db/           Prisma schema + SQLite client + seed script
│   └── agents/       Simulated department agent runners
└── docs/             AFL Constitution, Role Cards, Permission Model
```

## Quick Start (Codespaces / Local)

```bash
# 1. Install dependencies
pnpm install

# 2. Run database migrations (creates local SQLite file)
pnpm db:migrate

# 3. Seed initial agents + league state
pnpm seed

# 4. Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start Next.js dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Re-generate Prisma client after schema changes |
| `pnpm db:migrate` | Apply Prisma migrations (dev) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm seed` | Seed department agents + league state |

## Pages

| Route | Purpose |
|---|---|
| `/` | Dashboard — stat overview |
| `/agents` | Department agents list/detail + Run Agent |
| `/tasks` | Kanban board of all tasks |
| `/approvals` | Commissioner approve/reject Tier 2/3 proposals |
| `/ops` | Integrity alerts + deploy log |
| `/feed` | Real-time activity feed |

## Governance Tiers

| Tier | Scope | Approval |
|---|---|---|
| 0 | Emergency patches | Commissioner only |
| 1 | Config / operational | Auto-approve |
| 2 | Rule changes | Commissioner sign-off |
| 3 | Engine / scoring | Commissioner + multi-sig |

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **Language**: TypeScript 5.7
- **Styling**: Tailwind CSS 4
- **Database**: SQLite via Prisma 6
- **Package Manager**: pnpm 10 (workspace)

## Season 0 Mission

Build the Commissioner Control Room infrastructure before any game simulation:
agents exist as records, the orchestrator runs tasks, proposals flow through
change control, and the Commissioner has full visibility and veto power.

## Deploy on Railway

This repo includes `railway.toml` for build/start commands.

Set environment variable in Railway:

```bash
DATABASE_URL=file:./packages/db/prisma/dev.db
```

Notes:
- This uses SQLite.
- For persistent data across redeploys/restarts, mount a Railway volume and point `DATABASE_URL` to that mounted path (for example `file:/data/dev.db`).
