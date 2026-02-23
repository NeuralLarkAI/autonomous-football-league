"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Agent = { id: string; name: string; department: string };
type CombineRun = {
  id: string;
  runType: "COMBINE" | "SCRIMMAGE";
  status: string;
  createdAt: string;
  scoreOverall: number;
  scoreReliability: number;
  scoreLatency: number;
  durationMs: number;
  agent: Agent;
};

export default function CombinePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<CombineRun[]>([]);
  const [agentId, setAgentId] = useState("");
  const [scrimmageA, setScrimmageA] = useState("");
  const [scrimmageB, setScrimmageB] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const [agentsRes, runsRes] = await Promise.all([fetch("/api/agents"), fetch("/api/combine/runs")]);
    const [agentsData, runsData] = await Promise.all([agentsRes.json(), runsRes.json()]);
    setAgents(Array.isArray(agentsData) ? agentsData : []);
    setRuns(Array.isArray(runsData) ? runsData : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runCombine = async (e: FormEvent) => {
    e.preventDefault();
    if (!agentId) return;
    setRunning(true);
    setMessage(null);
    const res = await fetch("/api/combine/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, runType: "COMBINE" }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(
      res.ok
        ? `Combine complete for ${agentId}: overall ${data.scoreOverall}, reliability ${data.scoreReliability}`
        : data.error ?? "Combine failed."
    );
    await load();
    setRunning(false);
  };

  const requestScrimmage = async (e: FormEvent) => {
    e.preventDefault();
    if (!scrimmageA || !scrimmageB) return;
    setRunning(true);
    setMessage(null);
    const res = await fetch("/api/scrimmage/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentAId: scrimmageA, agentBId: scrimmageB }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(
      res.ok
        ? `Scrimmage winner: ${data.comparison.winner}`
        : data.error ?? "Scrimmage failed."
    );
    await load();
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Combine and Scrimmage</h1>
      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <form onSubmit={runCombine} className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Run Combine</h2>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
            <option value="">Select agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button disabled={running || !agentId} className="rounded bg-purple-700 px-3 py-1.5 text-sm text-purple-100 disabled:opacity-50">
            {running ? "Running..." : "Run Combine"}
          </button>
        </form>

        <form onSubmit={requestScrimmage} className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Request Scrimmage</h2>
          <select value={scrimmageA} onChange={(e) => setScrimmageA(e.target.value)} className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
            <option value="">Agent A</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select value={scrimmageB} onChange={(e) => setScrimmageB(e.target.value)} className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
            <option value="">Agent B</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button disabled={running || !scrimmageA || !scrimmageB || scrimmageA === scrimmageB} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-blue-100 disabled:opacity-50">
            {running ? "Running..." : "Run Scrimmage"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="mb-2 font-semibold text-slate-200">Recent Runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-slate-500">No combine runs yet.</p>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <Link key={run.id} href={`/combine/${run.id}`} className="block rounded bg-slate-900/70 px-3 py-2 hover:bg-slate-900">
                <p className="text-sm text-slate-200">
                  {run.agent.name} · {run.runType} · {run.status}
                </p>
                <p className="text-xs text-slate-500">
                  Overall {run.scoreOverall} | Reliability {run.scoreReliability} | Latency {run.scoreLatency} | {run.durationMs}ms
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
