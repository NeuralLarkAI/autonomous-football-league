"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Approval {
  id: string;
  tier: number;
  summary: string;
  status: string;
  createdAt: string;
  agent: { id: string; name: string; department: string } | null;
  task: { id: string; title: string } | null;
  proposal: { id: string; title: string; tier: number; status: string } | null;
}

const TIER_LABELS: Record<number, string> = {
  0: "Emergency",
  1: "Operational",
  2: "Rule Change",
  3: "Engine / Scoring",
};

const TIER_COLORS: Record<number, string> = {
  0: "bg-red-500/20 text-red-300 ring-red-500/30",
  1: "bg-slate-500/20 text-slate-300 ring-slate-500/30",
  2: "bg-yellow-500/20 text-yellow-300 ring-yellow-500/30",
  3: "bg-purple-500/20 text-purple-300 ring-purple-500/30",
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = () =>
    fetch("/api/approvals")
      .then((r) => r.json())
      .then((d) => { setApprovals(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const act = async (id: string, action: "approve" | "reject") => {
    setActing(id);
    await fetch(`/api/approvals/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await load();
    setActing(null);
  };

  if (loading) {
    return <div className="space-y-4"><h1 className="text-2xl font-bold text-slate-100">Approvals</h1><p className="text-slate-400">Loading…</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Approvals</h1>
        <span className="text-sm text-slate-400">{approvals.length} pending</span>
      </div>

      {approvals.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6 text-slate-400">
          No pending approvals. Run Season 0 Kickoff to generate Tier 2/3 proposals.
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => {
            const tierColor = TIER_COLORS[a.tier] ?? TIER_COLORS[1];
            const isActing = acting === a.id;
            return (
              <div
                key={a.id}
                className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${tierColor}`}>
                    Tier {a.tier} — {TIER_LABELS[a.tier] ?? ""}
                  </span>
                  {a.agent && (
                    <span className="text-xs text-slate-500">{a.agent.name}</span>
                  )}
                  <span className="ml-auto text-xs text-slate-500">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </div>
                <Link href={`/approvals/${a.id}`} className="text-sm text-slate-200 hover:underline">
                  {a.summary}
                </Link>
                {a.task && (
                  <p className="text-xs text-slate-500">Task: {a.task.title}</p>
                )}
                {a.proposal && (
                  <p className="text-xs text-slate-500">Proposal: {a.proposal.title}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    disabled={isActing}
                    onClick={() => act(a.id, "approve")}
                    className="rounded-lg bg-green-700/60 px-3 py-1.5 text-xs font-medium text-green-100 hover:bg-green-600/60 disabled:opacity-50 transition-colors"
                  >
                    {isActing ? "…" : "Approve"}
                  </button>
                  <button
                    disabled={isActing}
                    onClick={() => act(a.id, "reject")}
                    className="rounded-lg bg-red-800/60 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-700/60 disabled:opacity-50 transition-colors"
                  >
                    {isActing ? "…" : "Reject"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
