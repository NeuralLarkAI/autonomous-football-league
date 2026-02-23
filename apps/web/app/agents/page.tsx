"use client";

import { useEffect, useState } from "react";

interface Agent {
  id: string;
  name: string;
  department: string;
  role: string;
  status: string;
}

const DEPT_COLORS: Record<string, string> = {
  COMMISSIONER: "text-amber-400 bg-amber-500/10 ring-amber-500/30",
  TECHNOLOGY: "text-blue-400 bg-blue-500/10 ring-blue-500/30",
  SECURITY: "text-red-400 bg-red-500/10 ring-red-500/30",
  LEGAL_COMPLIANCE: "text-purple-400 bg-purple-500/10 ring-purple-500/30",
  FOOTBALL_OPS: "text-green-400 bg-green-500/10 ring-green-500/30",
  FINANCE: "text-yellow-400 bg-yellow-500/10 ring-yellow-500/30",
  MARKETING: "text-pink-400 bg-pink-500/10 ring-pink-500/30",
  PLAYER_PERSONNEL: "text-cyan-400 bg-cyan-500/10 ring-cyan-500/30",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => { setAgents(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const runAgent = async (agentId: string) => {
    setRunning(agentId);
    setMessages((m) => ({ ...m, [agentId]: "" }));
    try {
      const r = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const d = await r.json();
      if (r.ok) {
        setMessages((m) => ({ ...m, [agentId]: d.summary ?? "Done" }));
      } else {
        setMessages((m) => ({ ...m, [agentId]: d.error ?? "Failed" }));
      }
    } catch {
      setMessages((m) => ({ ...m, [agentId]: "Network error" }));
    } finally {
      setRunning(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-100">Agents</h1>
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-100">Agents</h1>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6 text-slate-400">
          No agents found. Run <code className="text-green-400">pnpm seed</code> first.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Agents</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => {
          const colorCls = DEPT_COLORS[agent.department] ?? "text-slate-400 bg-slate-500/10 ring-slate-500/30";
          const isRunning = running === agent.id;
          return (
            <div
              key={agent.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-700/50 bg-slate-800/60 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-100">{agent.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{agent.role}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${colorCls}`}>
                  {agent.department.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${agent.status === "ACTIVE" ? "bg-green-400" : "bg-slate-500"}`}
                />
                <span className="text-xs text-slate-500">{agent.status}</span>
              </div>
              {messages[agent.id] && (
                <p className="text-xs text-blue-300 bg-blue-900/20 rounded-lg px-3 py-1.5">
                  {messages[agent.id]}
                </p>
              )}
              <button
                onClick={() => runAgent(agent.id)}
                disabled={isRunning || running !== null}
                className="mt-auto rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600 disabled:opacity-40 transition-colors"
              >
                {isRunning ? "Running…" : "Run Agent"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
