"use client";

import { useEffect, useState } from "react";

interface DashboardStats {
  agentCount: number;
  openTaskCount: number;
  pendingApprovals: number;
  lastEventAt: string | null;
  seasonLock: boolean;
  season: number;
  phase: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [kickingOff, setKickingOff] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);
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
      const d = await r.json();
      setMessage(`Kickoff complete — ${d.totalTasks} tasks, ${d.totalApprovals} approvals created.`);
      load();
    } catch {
      setMessage("Kickoff failed. Check console.");
    } finally {
      setKickingOff(false);
    }
  };

  const toggleLock = async () => {
    if (!stats) return;
    setTogglingLock(true);
    try {
      await fetch("/api/league/season-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !stats.seasonLock }),
      });
      load();
    } finally {
      setTogglingLock(false);
    }
  };

  const statCards = [
    { label: "Active Agents", value: stats ? stats.agentCount : "…" },
    { label: "Open Tasks", value: stats ? stats.openTaskCount : "…" },
    { label: "Pending Approvals", value: stats ? stats.pendingApprovals : "…" },
    {
      label: "Last Event",
      value: stats?.lastEventAt
        ? new Date(stats.lastEventAt).toLocaleTimeString()
        : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">
            Commissioner Control Room
          </h1>
          <p className="mt-1 text-slate-400">
            Autonomous Football League — Season {stats?.season ?? 0}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${
            stats?.seasonLock
              ? "bg-red-500/20 text-red-400 ring-red-500/40"
              : "bg-amber-500/20 text-amber-400 ring-amber-500/40"
          }`}
        >
          {stats?.phase ?? "PRE-SEASON"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5"
          >
            <p className="text-sm text-slate-400">{s.label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-100">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={runKickoff}
          disabled={kickingOff}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {kickingOff ? "Running Kickoff…" : "Run Season 0 Kickoff"}
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
            {togglingLock ? "Updating…" : stats.seasonLock ? "Unlock Season" : "Lock Season"}
          </button>
        )}
      </div>

      {message && (
        <div className="rounded-xl border border-blue-700/40 bg-blue-900/20 p-4 text-sm text-blue-300">
          {message}
        </div>
      )}
    </div>
  );
}
