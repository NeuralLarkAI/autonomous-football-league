# AFL Optimization Roadmap

Last updated: February 27, 2026
Scope: Production web + worker + autonomous operations + external/public UI

## Operating model

- Chief of Staff: prioritization, sequencing, and weekly goals.
- Commissioner: policy guardrails, risk approvals, and autonomy thresholds.
- Execution (Codex): implementation, verification, deploy, and incident follow-through.

## Review consensus (current)

- Self-review outcome: reliability and deploy repeatability are the primary bottlenecks.
- Chief of Staff direction: maximize autonomous throughput while keeping task state transitions honest.
- Commissioner direction: enforce approvals/risk gates while enabling override paths for non-critical flow.

## Phase 0: Baseline Stabilization (in progress)

Objective: remove regressions and establish deploy confidence.

Work items:

1. Expand smoke coverage to external/public routes and registration flow.
2. Keep critical routes available with clear pass/fail checks (`/watch`, `/p/[slug]`, `/p/[slug]/join`).
3. Require type-check before release.

Exit criteria:

1. No broken primary tabs/buttons in the control room.
2. External UI routes are accessible and validated by script.
3. Deploy verification is scriptable and repeatable.

## Phase 1: Autonomous Engine Reliability

Objective: prevent idle loops and ensure continuous useful work.

Work items:

1. Enforce lifecycle transitions (`BACKLOG -> IN_PROGRESS -> REVIEW -> DONE|BLOCKED`) with telemetry.
2. Auto-refill backlog from Chief of Staff/Commissioner policy when queue drops below threshold.
3. Add stuck-task detectors and self-heal runbooks.

Exit criteria:

1. Continuous non-zero throughput while auto-run is enabled.
2. No long-lived stale tasks without explicit blocked reason.
3. Actionable dashboard metrics for cycle health and failure causes.

## Phase 2: Product Completeness (External + Internal)

Objective: complete real, non-mock functionality across all tabs/pages.

Work items:

1. External parity styling and behavior across games, standings, ranked, feed, and social.
2. Strict no-mock-data checks in production routes.
3. Mobile and accessibility pass for primary user flows.

Exit criteria:

1. Every nav tab and action has an end-to-end happy-path test.
2. Public pages present real data only.
3. User-facing errors are explicit and recoverable.

## Phase 3: On-chain Verification (Base)

Objective: verifiable league outcomes with minimal gas/complexity.

Work items:

1. Define canonical game result payload and deterministic hash.
2. Anchor finalized game outcomes and season snapshots on Base.
3. Show verification state and explorer links in UI.

Exit criteria:

1. Finalized games include on-chain tx references.
2. Standings snapshots have reproducible proofs.
3. Public viewers can verify results independently.

## Phase 4: Security, Cost, and Performance Hardening

Objective: predictable spend and safer autonomous operation.

Work items:

1. Rate limiting, abuse controls, and credential scope tightening.
2. Token/API budget controls with fallback behavior on quota/429 events.
3. Query and worker-loop optimization for p95 latency.

Exit criteria:

1. Spend alerts and upper bounds in place.
2. No critical auth or over-permissioned key paths.
3. Stable service health under normal and burst conditions.

## Phase 5: Ops cadence

Objective: continuous improvement with measurable weekly deltas.

Work items:

1. Weekly scorecard: throughput, approval latency, incident MTTR, run failure rate.
2. Regression triage and prevention backlog.
3. Monthly architecture and policy review.

Exit criteria:

1. Weekly reliability and throughput trend improves.
2. Incidents get faster to detect and resolve.

## Execution board (next 7 days)

1. `P0-1`: Add and run external smoke script in release workflow.
2. `P0-2`: Expand Playwright coverage for external routes.
3. `P1-1`: Add stuck-task detector + auto-unblock runbook.
4. `P1-2`: Add backlog low-watermark refill policy and telemetry.
5. `P2-1`: Finish branded external subpages (`games`, `standings`, `ranked`, `feed`, `social`).

