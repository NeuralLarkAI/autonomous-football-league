"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface DashboardStats {
  agentCount: number;
  openTaskCount: number;
  pendingApprovals: number;
  lastEventAt: string | null;
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
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [kickingOff, setKickingOff] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);
  const [quickAction, setQuickAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = () =>
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const runKickoff = async () => {
    setKickingOff(true);
    setMessage(null);
    try {
      const r = await fetch("/api/season0/kickoff", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      setMessage(
        r.ok
          ? `Kickoff complete - ${d.totalTasks} tasks, ${d.totalApprovals} approvals created.`
          : d.error ?? "Kickoff failed."
      );
      load();
    } finally {
      setKickingOff(false);
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

      <div className="flex flex-wrap gap-3">
        <button
          onClick={runKickoff}
          disabled={kickingOff}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {kickingOff ? "Running Kickoff..." : "Run Season 0 Kickoff"}
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
