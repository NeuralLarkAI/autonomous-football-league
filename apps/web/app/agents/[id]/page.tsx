"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type AgentDetail = {
  id: string;
  name: string;
  department: string;
  role: string;
  status: string;
  roleCardMd: string;
  permissionScopesParsed: string[];
  kpisParsed: Record<string, number>;
  openTasks: Array<{ id: string; title: string; status: string; tier: number }>;
  lastEvents: Array<{ id: string; type: string; summary: string; createdAt: string }>;
  runHistory: Array<{
    id: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    outputsCreated: number;
    status: string;
  }>;
  lastRun: {
    id: string;
    startedAt: string;
    durationMs: number;
    status: string;
  } | null;
  lastCombineRun: {
    id: string;
    createdAt: string;
    status: string;
    scoreOverall: number;
    scoreReliability: number;
  } | null;
  reliabilityTrend: Array<{
    id: string;
    createdAt: string;
    scoreReliability: number;
    scoreOverall: number;
  }>;
};

export default function AgentDetailPage() {
  const { id, slug } = useParams<{ id: string; slug?: string }>();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [combining, setCombining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/agents/${id}`);
    const data = await res.json();
    setAgent(res.ok ? data : null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const runAgent = async () => {
    setRunning(true);
    setMessage(null);
    const res = await fetch("/api/agents/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: id }),
    });
    const data = await res.json();
    setMessage(res.ok ? data.summary ?? "Run complete" : data.error ?? "Run failed");
    await load();
    setRunning(false);
  };

  const generateWeeklyReport = async () => {
    setReporting(true);
    setMessage(null);
    const res = await fetch(`/api/agents/${id}/weekly-report`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? `Weekly report created: ${data.message?.title}` : data.error ?? "Report failed");
    await load();
    setReporting(false);
  };

  const runCombine = async () => {
    setCombining(true);
    setMessage(null);
    const res = await fetch("/api/combine/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: id, runType: "COMBINE" }),
    });
    const data = await res.json();
    setMessage(
      res.ok
        ? `Combine complete: overall ${data.scoreOverall}, reliability ${data.scoreReliability}`
        : data.error ?? "Combine failed"
    );
    await load();
    setCombining(false);
  };

  if (loading) return <p className="text-slate-400">Loading...</p>;
  if (!agent) return <p className="text-red-400">Agent not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{agent.department}</p>
          <h1 className="text-3xl font-bold text-slate-100">{agent.name}</h1>
          <p className="text-slate-400">{agent.role}</p>
          {agent.lastRun && (
            <p className="mt-1 text-xs text-slate-500">
              Last run: {new Date(agent.lastRun.startedAt).toLocaleString()} ({agent.lastRun.durationMs} ms, {agent.lastRun.status})
            </p>
          )}
          {agent.lastCombineRun && (
            <p className="mt-1 text-xs text-slate-500">
              Last combine: {new Date(agent.lastCombineRun.createdAt).toLocaleString()} (overall {agent.lastCombineRun.scoreOverall}, reliability {agent.lastCombineRun.scoreReliability})
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={runAgent}
            disabled={running}
            className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-blue-100 disabled:opacity-50"
          >
            {running ? "Running..." : "Run Agent"}
          </button>
          <button
            onClick={generateWeeklyReport}
            disabled={reporting}
            className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
          >
            {reporting ? "Generating..." : "Generate Weekly Report"}
          </button>
          <button
            onClick={runCombine}
            disabled={combining}
            className="rounded-lg bg-purple-700 px-3 py-2 text-sm text-purple-100 disabled:opacity-50"
          >
            {combining ? "Running..." : "Run Combine"}
          </button>
          <Link
            href={`/l/${slug ?? "afl-prime"}/agents/${id}/submissions`}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-emerald-100"
          >
            Submissions
          </Link>
          <Link
            href={`/l/${slug ?? "afl-prime"}/agents/${id}/keys`}
            className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-100"
          >
            Keys
          </Link>
        </div>
      </div>

      {message && <p className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4 md:col-span-2">
          <h2 className="mb-2 font-semibold text-slate-200">Role Card</h2>
          <pre className="whitespace-pre-wrap text-xs text-slate-300">{agent.roleCardMd || "No role card."}</pre>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="mb-2 font-semibold text-slate-200">Permission Scopes</h2>
          <div className="space-y-1">
            {agent.permissionScopesParsed.length === 0 && <p className="text-xs text-slate-500">No scopes</p>}
            {agent.permissionScopesParsed.map((scope) => (
              <span key={scope} className="block rounded bg-slate-900/60 px-2 py-1 text-xs text-slate-300">
                {scope}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="mb-2 font-semibold text-slate-200">KPIs</h2>
          <div className="space-y-1 text-sm text-slate-300">
            {Object.entries(agent.kpisParsed).map(([k, v]) => (
              <p key={k}>
                {k}: {v}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="mb-2 font-semibold text-slate-200">Reliability Trend</h2>
          {agent.reliabilityTrend.length === 0 ? (
            <p className="text-sm text-slate-500">No combine runs yet.</p>
          ) : (
            <div className="space-y-1 text-xs text-slate-300">
              {agent.reliabilityTrend.slice(-5).map((r) => (
                <p key={r.id}>
                  {new Date(r.createdAt).toLocaleDateString()}: reliability {r.scoreReliability}, overall {r.scoreOverall}
                </p>
              ))}
            </div>
          )}
          {agent.lastCombineRun && (
            <Link href={`/combine/${agent.lastCombineRun.id}`} className="mt-2 inline-block text-xs text-blue-400 hover:underline">
              View latest combine
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4 md:col-span-2">
          <h2 className="mb-2 font-semibold text-slate-200">Open Tasks</h2>
          {agent.openTasks.length === 0 ? (
            <p className="text-sm text-slate-500">No open tasks.</p>
          ) : (
            <div className="space-y-2">
              {agent.openTasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="block rounded bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900">
                  [{task.status}] T{task.tier} {task.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="mb-2 font-semibold text-slate-200">Agent Run History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-300">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-1 text-left">Timestamp</th>
                <th className="px-2 py-1 text-left">Outputs</th>
                <th className="px-2 py-1 text-left">Duration (ms)</th>
                <th className="px-2 py-1 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {agent.runHistory.map((run) => (
                <tr key={run.id} className="border-t border-slate-700/50">
                  <td className="px-2 py-1">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="px-2 py-1">{run.outputsCreated}</td>
                  <td className="px-2 py-1">{run.durationMs}</td>
                  <td className="px-2 py-1">{run.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="mb-2 font-semibold text-slate-200">Last 25 Events</h2>
        <div className="space-y-2">
          {agent.lastEvents.map((ev) => (
            <div key={ev.id} className="rounded bg-slate-900/60 px-3 py-2 text-sm">
              <p className="text-slate-200">{ev.summary}</p>
              <p className="text-xs text-slate-500">
                {ev.type} - {new Date(ev.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
