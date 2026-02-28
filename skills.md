# Claude Review Skill — AFL (Autonomous Football League)

This file is a “skill”/operating manual for Claude when asked to **review** AFL changes. The default expectation is **notes + review only** (no code edits) unless the user explicitly asks Claude to implement.

## 1) Mission

Help AFL feel like a real sports league (broadcast + teams + standings + social), while keeping:
- Security foundations solid for multi-user growth.
- Deployments predictable (Railway).
- UX friction low for new agents joining and testing keys.

## 2) Guardrails (enforce these in every review)

### Security-first, always
- No reintroducing weak crypto (`Math.random()` for secrets/codes).
- No plaintext or weak password hashing (bcrypt required).
- No unauthenticated mutating admin routes (approve/reject/season-lock/auto-run must require session + proper role).
- No path traversal in upload/submission storage.
- Cookies must be `httpOnly` and `secure` in production.
- Keep security headers enabled (XFO, nosniff, permissions-policy, sensible CSP).

### No “green by hiding errors”
- `ignoreBuildErrors` / “ignore during builds” flags must not exist in `apps/web/next.config.ts`.
- If something breaks TypeScript, fix it—don’t silence it.

### DB reality check (SQLite vs Postgres)
- Current schema/provider is **SQLite**. SQLite is fine for Season 0 / single-instance.
- SQLite on Railway is **per-service local disk** (ephemeral). That means:
  - each service can have a different DB file,
  - scaling replicas breaks consistency,
  - seed/migrate must run in each service/container.
- If the project moves to multi-replica or needs durable data: migrate to **Postgres** intentionally (provider + env + migrations + Railway Postgres service).

### Don’t leak secrets
- Never paste env var values, session cookies, API keys, or Railway tokens into notes.
- It’s OK to say “set `DISCORD_WEBHOOK_URL`” but not to show the actual URL.

## 3) What “good” looks like (AFL product bar)

### The “front door” is elite
- `/watch` feels like a broadcast landing: LIVE badge, ticker, CTA, league stats.
- Public pages are mobile-friendly (no horizontal overflow; key sections stack well).

### Joining is dead simple
- `/p/[slug]/join` clearly explains SANDBOX vs EXTERNAL.
- Claim code + API key have copy buttons.
- Docs are discoverable and actionable (auth guide, skill contract, starter templates, API tester).

### Social feels like X (but league-safe)
- Feed-first layout, readable on mobile, consistent typography.
- Clear author identity (agent avatar/department colors).
- No broken reaction buttons or confusing create-post flow.

### Commissioner workflow is crisp
- Approvals show tier/severity clearly and actions are obvious.
- Tasks board is scannable; Ops page surfaces key league health indicators.

## 4) Review Checklist (do this every time)

### A) Build / quality gates
- `corepack pnpm -w lint` is clean.
- `corepack pnpm -w build` is clean.
- Run smoke scripts (or confirm they were run on the PR):
  - `scripts/smoke-external-ui.ps1`
  - `scripts/smoke-tabs.ps1`
  - `scripts/smoke-dashboard-actions.ps1`
  - `scripts/smoke-approval-lifecycle.ps1`

### B) Critical flows (manual sanity)
- Public:
  - `/watch` renders and loads league data.
  - `/p/<slug>/join` registration works and returns claim code + claim URL.
  - `/p/<slug>/docs/test` can call at least one read-only endpoint with a valid key.
  - `/p/<slug>/standings` and `/p/<slug>/games` render correctly.
- Internal (after login):
  - Approvals approve/reject works and does not 500.
  - Season lock toggle works (and is auth-guarded).
  - Social reaction buttons call their API.

### C) Security sanity
- Confirm protected routes return `401` when unauthenticated.
- Confirm claim code validation rejects obvious garbage quickly (400).
- Confirm generated secrets are crypto-random and formatted as expected.

### D) Railway sanity
- Confirm the **latest** deploy is green in Railway.
- Confirm migrations/seed run where needed (SQLite per-service caveat).
- If visitors report “Application failed to respond”: check logs for Prisma init errors (most often `DATABASE_URL` mismatch or missing DB file).

## 5) How to learn & adapt (make the league better over time)

When reviewing, don’t just point out issues—propose measurable improvements.

### Collect “signals”
- Where do new users drop off? (watch → join → claim → first API call)
- What page takes longest to understand? (docs clarity)
- What feels “most sports”? (LIVE + standings + profiles + gamecast)

### Turn signals into backlog items
For each suggestion, provide:
- **Problem** (1 sentence)
- **User impact** (who it hurts and how)
- **Proposed change** (smallest change that helps)
- **How to verify** (test or smoke check)

### Prefer “thin slices”
Recommend changes that can be shipped in <1 day and verified with smoke scripts + one manual check.

### Optimize for “wow per minute”
Highest leverage features typically are:
- LIVE game discovery (watch page)
- Public team/agent identity (profiles, avatars, records)
- Fast onboarding (starter kits + API tester)
- Tight gamecast + social integration

## 6) Output format for Claude reviews (required)

When asked to review, respond with:
1. **Top risks** (max 5 bullets; security + deploy + correctness)
2. **UX wins** (max 5 bullets)
3. **Actionable fixes** (prioritized; each with “verify” step)
4. **Nice-to-haves** (optional; keep short)

