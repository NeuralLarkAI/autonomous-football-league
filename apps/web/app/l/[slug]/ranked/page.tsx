"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Leader = {
  agentId: string;
  agentName: string;
  mode: string;
  rating: number;
  matches: number;
  eligibility: "ELIGIBLE" | "INELIGIBLE";
  latestSubmissionStatus: string;
};

type Match = {
  id: string;
  createdAt: string;
  scoreA: number;
  scoreB: number;
  winnerAgentId: string | null;
  agentA: { id: string; name: string };
  agentB: { id: string; name: string };
};

export default function RankedPage() {
  const { slug } = useParams<{ slug: string }>();
  const [leaderboard, setLeaderboard] = useState<Leader[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [agentAId, setAgentAId] = useState("");
  const [agentBId, setAgentBId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/l/${slug}/ranked`);
    const data = await res.json().catch(() => ({ leaderboard: [], matches: [] }));
    setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : []);
    setMatches(Array.isArray(data.matches) ? data.matches : []);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const runDuel = async (e: FormEvent) => {
    e.preventDefault();
    if (!agentAId || !agentBId || agentAId === agentBId) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/l/${slug}/ranked`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentAId, agentBId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(data.winnerAgentId ? `Duel complete. Winner: ${data.winnerAgentId}` : "Duel complete. Draw.");
      await load();
    } else {
      setMessage(data.error ?? "Ranked duel failed");
    }
    setBusy(false);
  };

  const eligible = leaderboard.filter((l) => l.eligibility === "ELIGIBLE");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Ranked Combine Ladder</h1>
      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}

      <form onSubmit={runDuel} className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Run Ranked Duel</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select value={agentAId} onChange={(e) => setAgentAId(e.target.value)} className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
            <option value="">Agent A</option>
            {eligible.map((a) => (
              <option key={a.agentId} value={a.agentId}>
                {a.agentName}
              </option>
            ))}
          </select>
          <select value={agentBId} onChange={(e) => setAgentBId(e.target.value)} className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
            <option value="">Agent B</option>
            {eligible.map((a) => (
              <option key={a.agentId} value={a.agentId}>
                {a.agentName}
              </option>
            ))}
          </select>
        </div>
        <button
          disabled={busy || !agentAId || !agentBId || agentAId === agentBId}
          className="mt-3 rounded bg-blue-700 px-3 py-1.5 text-sm text-blue-100 disabled:opacity-50"
        >
          {busy ? "Running..." : "Run Ranked Duel"}
        </button>
      </form>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Leaderboard</h2>
        <div className="space-y-2">
          {leaderboard.map((l) => (
            <div key={l.agentId} className="rounded bg-slate-900/70 px-3 py-2 text-sm">
              <p className="text-slate-200">
                {l.agentName} - {l.rating} Elo ({l.matches} matches)
              </p>
              <p className={`text-xs ${l.eligibility === "ELIGIBLE" ? "text-emerald-300" : "text-slate-500"}`}>
                {l.eligibility} | {l.mode} | latest submission: {l.latestSubmissionStatus}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Match History</h2>
        <div className="space-y-2">
          {matches.length === 0 && <p className="text-sm text-slate-500">No ranked matches yet.</p>}
          {matches.map((m) => (
            <div key={m.id} className="rounded bg-slate-900/70 px-3 py-2 text-sm">
              <p className="text-slate-200">
                {m.agentA.name} ({m.scoreA.toFixed(2)}) vs {m.agentB.name} ({m.scoreB.toFixed(2)})
              </p>
              <p className="text-xs text-slate-500">
                {m.winnerAgentId ? `Winner: ${m.winnerAgentId}` : "Draw"} | {new Date(m.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
