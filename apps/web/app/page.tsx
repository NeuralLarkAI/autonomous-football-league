"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface DashboardStats {
  agentCount: number;
  openTaskCount: number;
  pendingApprovals: number;
  lastEventAt: string | null;
  autoRunEnabled: boolean;
  seasonLock: boolean;
  season: number;
  phase: string;
  activePhase: null | {
    id: string;
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  nextRunbooks: Array<{
    id: string;
    name: string;
    actionType: string;
    triggerType: string;
    ownerAgent: { id: string; name: string } | null;
  }>;
  seasonZero: {
    tasksTotal: number;
    proposalsPending: number;
    approvalsPendingTier23: number;
    incidentsOpen: number;
    postsCount: number;
    combineRunsCount: number;
  };
  seasonOne: null | {
    id: string;
    status: string;
    teamCount: number;
    gameCount: number;
    weekOneFinal: number;
    weekOneTotal: number;
  };
}

export default function DashboardPage() {
  const pathname = usePathname();
  const leagueSlug = pathname.split("/")[2] || "afl-prime";
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [liveGames, setLiveGames] = useState<Array<{ id: string; week: number; awayTeam: { shortName: string }; homeTeam: { shortName: string }; scoreAway: number; scoreHome: number }>>([]);
  const [nextGames, setNextGames] = useState<Array<{ id: string; week: number; awayTeam: { shortName: string }; homeTeam: { shortName: string }; kickoffAt: string | null }>>([]);
  const [socialPreview, setSocialPreview] = useState<Array<{ id: string; title: string; createdAt: string }>>([]);
  const [ladderPreview, setLadderPreview] = useState<Array<{ agentId: string; agentName: string; rating: number }>>([]);
  const [upcomingRuns, setUpcomingRuns] = useState<
    Array<{
      id: string;
      name: string;
      actionType: string;
      nextRunAt: string | null;
      lastRunAt: string | null;
      failureCount: number;
      latestRun: { status: string; startedAt: string | null; finishedAt: string | null; errorText: string | null } | null;
    }>
  >([]);
  const [togglingLock, setTogglingLock] = useState(false);
  const [togglingAutoRun, setTogglingAutoRun] = useState(false);
  const [quickAction, setQuickAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runRunbookByActionType = useCallback(
    async (actionType: string, payload?: Record<string, unknown>) => {
      const runbooksRes = await fetch("/api/runbooks");
      const runbooks = (await runbooksRes.json().catch(() => [])) as Array<{
        id: string;
        actionType: string;
        isEnabled: boolean;
      }>;
      const target = runbooks.find((r) => r.actionType === actionType && r.isEnabled);
      if (!target) {
        throw new Error(`No enabled ${actionType} runbook found.`);
      }

      if (payload) {
        const patchRes = await fetch(`/api/runbooks/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionPayloadJson: JSON.stringify(payload) }),
        });
        if (!patchRes.ok) {
          const data = await patchRes.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to update runbook payload.");
        }
      }

      const runRes = await fetch(`/api/runbooks/${target.id}/run`, { method: "POST" });
      const runData = await runRes.json().catch(() => ({}));
      if (!runRes.ok) {
        throw new Error(runData.error ?? "Runbook execution failed.");
      }
      return runData;
    },
    []
  );

  const load = useCallback(
    () =>
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()).catch(() => null),
      fetch(`/api/l/${leagueSlug}/games?status=LIVE`).then((r) => r.json()).catch(() => []),
      fetch(`/api/l/${leagueSlug}/games?status=SCHEDULED`).then((r) => r.json()).catch(() => []),
      fetch("/api/social/posts").then((r) => r.json()).catch(() => []),
      fetch(`/api/l/${leagueSlug}/ranked`).then((r) => r.json()).catch(() => ({ leaderboard: [] })),
      fetch(`/api/l/${leagueSlug}/runbooks/next`).then((r) => r.json()).catch(() => []),
    ]).then(([dashboard, live, scheduled, social, ranked, next]) => {
      setStats(dashboard);
      setLiveGames(Array.isArray(live) ? live.slice(0, 3) : []);
      setNextGames(Array.isArray(scheduled) ? scheduled.slice(0, 3) : []);
      setSocialPreview(Array.isArray(social) ? social.slice(0, 3) : []);
      setLadderPreview(Array.isArray(ranked?.leaderboard) ? ranked.leaderboard.slice(0, 10) : []);
      setUpcomingRuns(Array.isArray(next) ? next : []);
    }),
    [leagueSlug]
  );

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const runSeasonZeroKickoffAgents = async () => {
    setQuickAction("season0-kickoff");
    setMessage(null);
    try {
      const r = await fetch("/api/season0/kickoff", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Season 0 kickoff failed.");
      setMessage(
        `Season 0 kickoff complete: ${d.tasksTotal ?? 0} tasks, ${d.proposalsTotal ?? 0} proposals, ${d.incidentsTotal ?? 0} incidents, ${d.socialPostsTotal ?? 0} posts.`
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setQuickAction(null);
    }
  };

  const runWeeklyCycle = async () => {
    setQuickAction("weekly-cycle");
    setMessage(null);
    try {
      const res = await fetch("/api/runbooks");
      const runbooks = (await res.json().catch(() => [])) as Array<{ id: string; name: string; isEnabled: boolean }>;
      const names = [
        "Weekly Commissioner Brief",
        "Weekly Integrity Audit",
        "Weekly Combine",
        "Weekly Broadcast Recap",
      ];
      const executed: string[] = [];
      for (const name of names) {
        const runbook = runbooks.find((r) => r.name === name && r.isEnabled);
        if (!runbook) continue;
        const runRes = await fetch(`/api/runbooks/${runbook.id}/run`, { method: "POST" });
        if (runRes.ok) executed.push(name);
      }
      setMessage(
        executed.length > 0
          ? `Weekly cycle complete: ${executed.join(", ")}`
          : "No enabled weekly runbooks found."
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setQuickAction(null);
    }
  };

  const runWeeklyReport = async () => {
    setQuickAction("report");
    const r = await fetch("/api/agents/commissioner/weekly-report", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setMessage(r.ok ? "Weekly report generated." : d.error ?? "Weekly report failed.");
    load();
    setQuickAction(null);
  };

  const runIntegrityAudit = async () => {
    setQuickAction("integrity");
    const r = await fetch("/api/agents/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "integrity" }),
    });
    const d = await r.json().catch(() => ({}));
    setMessage(r.ok ? d.summary ?? "Integrity audit complete." : d.error ?? "Integrity audit failed.");
    load();
    setQuickAction(null);
  };

  const runSeasonOneSetup = async () => {
    setQuickAction("season1-setup");
    setMessage(null);
    try {
      await runRunbookByActionType("SEASON1_SETUP", { seasonNumber: 1, teamCount: 8 });
      setMessage("Season 1 setup runbook completed.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setQuickAction(null);
    }
  };

  const simulateWeekOne = async () => {
    setQuickAction("week1");
    setMessage(null);
    try {
      await runRunbookByActionType("WEEK_SIMULATE", { weekNumber: 1, mode: "RUN_TO_FINAL", stepSizePlays: 20 });
      setMessage("Week 1 simulation runbook completed.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setQuickAction(null);
    }
  };

  const toggleLock = async () => {
    if (!stats) return;
    setTogglingLock(true);
    try {
      const r = await fetch("/api/league/season-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !stats.seasonLock }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMessage(d.error ?? "Season lock update failed.");
      load();
    } finally {
      setTogglingLock(false);
    }
  };

  const toggleAutoRun = async () => {
    if (!stats) return;
    setTogglingAutoRun(true);
    try {
      const r = await fetch(`/api/l/${leagueSlug}/autorun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !stats.autoRunEnabled }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMessage(d.error ?? "Auto-run update failed.");
      else setMessage(!stats.autoRunEnabled ? "Auto-run enabled." : "Auto-run disabled.");
      await load();
    } finally {
      setTogglingAutoRun(false);
    }
  };

  const runDueNow = async () => {
    setQuickAction("run-due");
    setMessage(null);
    try {
      const now = Date.now();
      const due = upcomingRuns.filter((r) => r.nextRunAt && new Date(r.nextRunAt).getTime() <= now);
      if (due.length === 0) {
        setMessage("No due scheduled runbooks right now.");
        return;
      }
      let ran = 0;
      for (const runbook of due) {
        const res = await fetch(`/api/runbooks/${runbook.id}/run`, { method: "POST" });
        if (res.ok) ran += 1;
      }
      setMessage(`Triggered ${ran}/${due.length} due runbook(s).`);
      await load();
    } finally {
      setQuickAction(null);
    }
  };

  const statCards = [
    { label: "Active Agents", value: stats ? stats.agentCount : "..." },
    { label: "Open Tasks", value: stats ? stats.openTaskCount : "..." },
    { label: "Pending Approvals", value: stats ? stats.pendingApprovals : "..." },
    {
      label: "Last Event",
      value: stats?.lastEventAt ? new Date(stats.lastEventAt).toLocaleTimeString() : "-",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Commissioner Control Room</h1>
          <p className="mt-1 text-slate-400">Autonomous Football League - Season {stats?.season ?? 0}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${
            stats?.seasonLock
              ? "bg-red-500/20 text-red-400 ring-red-500/40"
              : "bg-amber-500/20 text-amber-400 ring-amber-500/40"
          }`}
        >
          {stats?.phase ?? "PRE_SEASON"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
            <p className="text-sm text-slate-400">{s.label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-100">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Active Phase</h2>
          {stats?.activePhase ? (
            <>
              <p className="mt-1 text-slate-100">{stats.activePhase.name}</p>
              <p className="text-xs text-slate-400">{stats.activePhase.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(stats.activePhase.startDate).toLocaleDateString()} - {new Date(stats.activePhase.endDate).toLocaleDateString()}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">No active phase.</p>
          )}
          <Link href="/season" className="mt-2 inline-block text-xs text-blue-400 hover:underline">
            View timeline
          </Link>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Next Runbooks</h2>
          {stats?.nextRunbooks?.length ? (
            <div className="mt-1 space-y-1">
              {stats.nextRunbooks.map((r) => (
                <p key={r.id} className="text-xs text-slate-300">
                  {r.name} - {r.actionType} ({r.triggerType})
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-500">No enabled runbooks.</p>
          )}
          <Link href="/runbooks" className="mt-2 inline-block text-xs text-blue-400 hover:underline">
            Open runbooks
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Auto-run</h2>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                stats?.autoRunEnabled ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"
              }`}
            >
              {stats?.autoRunEnabled ? "ENABLED" : "DISABLED"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            When enabled, scheduled runbooks execute continuously without manual clicks.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={toggleAutoRun}
              disabled={togglingAutoRun}
              className="rounded bg-indigo-700 px-3 py-1.5 text-xs text-indigo-100 hover:bg-indigo-600 disabled:opacity-50"
            >
              {togglingAutoRun ? "Updating..." : stats?.autoRunEnabled ? "Disable Auto-run" : "Enable Auto-run"}
            </button>
            <button
              onClick={runDueNow}
              disabled={quickAction !== null}
              className="rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-600 disabled:opacity-50"
            >
              {quickAction === "run-due" ? "Running..." : "Run due now"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Upcoming Runs</h2>
          {upcomingRuns.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">No scheduled runbooks.</p>
          ) : (
            <div className="mt-2 space-y-1 text-xs text-slate-300">
              {upcomingRuns.slice(0, 5).map((run) => (
                <p key={run.id}>
                  {run.name} - {run.nextRunAt ? new Date(run.nextRunAt).toLocaleTimeString() : "unscheduled"} - failures {run.failureCount}
                </p>
              ))}
            </div>
          )}
          <Link href="/runbooks" className="mt-2 inline-block text-xs text-blue-400 hover:underline">
            Manage schedules
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Season 0 Progress</h2>
          <div className="mt-2 space-y-1 text-sm text-slate-300">
            <p>Tasks: {stats?.seasonZero?.tasksTotal ?? 0}</p>
            <p>Pending Proposals: {stats?.seasonZero?.proposalsPending ?? 0}</p>
            <p>Pending Tier 2/3 Approvals: {stats?.seasonZero?.approvalsPendingTier23 ?? 0}</p>
            <p>Open Incidents: {stats?.seasonZero?.incidentsOpen ?? 0}</p>
            <p>Social Posts: {stats?.seasonZero?.postsCount ?? 0}</p>
            <p>Combine Runs: {stats?.seasonZero?.combineRunsCount ?? 0}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <Link href={`/l/${leagueSlug}/tasks?createdWithin=24h`} className="text-blue-400 hover:underline">Tasks last 24h</Link>
            <Link href={`/l/${leagueSlug}/approvals?tier=2,3&status=PENDING`} className="text-blue-400 hover:underline">Pending Tier 2/3 approvals</Link>
            <Link href={`/l/${leagueSlug}/incidents?status=OPEN`} className="text-blue-400 hover:underline">Open incidents</Link>
            <Link href={`/l/${leagueSlug}/social?recent=1`} className="text-blue-400 hover:underline">Recent social posts</Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Season 1 Status</h2>
          {stats?.seasonOne ? (
            <div className="mt-2 space-y-1 text-sm text-slate-300">
              <p>Status: {stats.seasonOne.status}</p>
              <p>Teams: {stats.seasonOne.teamCount}</p>
              <p>Games: {stats.seasonOne.gameCount}</p>
              <p>
                Week 1: {stats.seasonOne.weekOneFinal}/{stats.seasonOne.weekOneTotal} final
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Season 1 not initialized yet.</p>
          )}
          <Link href={`/l/${leagueSlug}/games`} className="mt-2 inline-block text-xs text-blue-400 hover:underline">
            Open schedule
          </Link>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Live Now</h2>
          {liveGames.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">No live games.</p>
          ) : (
            <div className="mt-2 space-y-1 text-sm text-slate-300">
              {liveGames.map((g) => (
                <Link key={g.id} href={`/l/${leagueSlug}/games/${g.id}`} className="block hover:underline">
                  W{g.week} {g.awayTeam.shortName} {g.scoreAway} - {g.homeTeam.shortName} {g.scoreHome}
                </Link>
              ))}
            </div>
          )}
          <Link href={`/l/${leagueSlug}/games`} className="mt-2 inline-block text-xs text-blue-400 hover:underline">
            Open Game Center
          </Link>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Next Up</h2>
          {nextGames.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">No scheduled games.</p>
          ) : (
            <div className="mt-2 space-y-1 text-sm text-slate-300">
              {nextGames.map((g) => (
                <p key={g.id}>
                  W{g.week} {g.awayTeam.shortName} @ {g.homeTeam.shortName}{" "}
                  <span className="text-xs text-slate-500">{g.kickoffAt ? new Date(g.kickoffAt).toLocaleDateString() : "TBD"}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Social Preview</h2>
          {socialPreview.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">No posts yet.</p>
          ) : (
            <div className="mt-2 space-y-1 text-sm text-slate-300">
              {socialPreview.map((p) => (
                <Link key={p.id} href={`/l/${leagueSlug}/social/${p.id}`} className="block hover:underline">
                  {p.title}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Ranked Ladder (Top 10)</h2>
          {ladderPreview.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">No ranked entries yet.</p>
          ) : (
            <div className="mt-2 space-y-1 text-sm text-slate-300">
              {ladderPreview.map((r, i) => (
                <p key={r.agentId}>
                  #{i + 1} {r.agentName} - {r.rating}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={runSeasonZeroKickoffAgents}
          disabled={quickAction !== null}
          className="rounded-lg bg-fuchsia-700 px-4 py-2 text-sm font-medium text-fuchsia-100 hover:bg-fuchsia-600 disabled:opacity-50"
        >
          {quickAction === "season0-kickoff" ? "Running..." : "Run Season 0 Kickoff (Agents)"}
        </button>
        <button
          onClick={runWeeklyCycle}
          disabled={quickAction !== null}
          className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-sky-100 hover:bg-sky-600 disabled:opacity-50"
        >
          {quickAction === "weekly-cycle" ? "Running..." : "Run Weekly Cycle"}
        </button>
        <button
          onClick={runSeasonOneSetup}
          disabled={quickAction !== null}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 disabled:opacity-50"
        >
          {quickAction === "season1-setup" ? "Running..." : "Run Season 1 Setup"}
        </button>
        <button
          onClick={simulateWeekOne}
          disabled={quickAction !== null}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-teal-100 hover:bg-teal-600 disabled:opacity-50"
        >
          {quickAction === "week1" ? "Running..." : "Simulate Week 1"}
        </button>
        <button
          onClick={runWeeklyReport}
          disabled={quickAction !== null}
          className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-600 disabled:opacity-50"
        >
          {quickAction === "report" ? "Running..." : "Run Weekly Report"}
        </button>
        <button
          onClick={runIntegrityAudit}
          disabled={quickAction !== null}
          className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-purple-100 hover:bg-purple-600 disabled:opacity-50"
        >
          {quickAction === "integrity" ? "Running..." : "Run Integrity Audit"}
        </button>
        {stats && (
          <button
            onClick={toggleLock}
            disabled={togglingLock}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              stats.seasonLock
                ? "bg-green-700 text-green-100 hover:bg-green-600"
                : "bg-red-800/60 text-red-200 hover:bg-red-700/60"
            }`}
          >
            {togglingLock ? "Updating..." : stats.seasonLock ? "Unlock Season" : "Lock Season"}
          </button>
        )}
      </div>

      {message && <div className="rounded-xl border border-blue-700/40 bg-blue-900/20 p-4 text-sm text-blue-300">{message}</div>}
    </div>
  );
}
