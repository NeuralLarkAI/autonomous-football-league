"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AgentAvatar } from "@/components/agent-avatar";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

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
  0: "bg-rose-600/20 text-rose-200 ring-rose-500/30",
  1: "bg-cyan-600/15 text-cyan-200 ring-cyan-500/30",
  2: "bg-amber-600/15 text-amber-200 ring-amber-500/30",
  3: "bg-red-600/15 text-red-200 ring-red-500/30",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetch("/api/approvals", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setApprovals(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load approvals.");
        setLoading(false);
      });

  useEffect(() => { load(); }, []);

  const act = async (id: string, action: "approve" | "reject") => {
    setActing(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/approvals/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const message = typeof data.error === "string" ? data.error : `Failed to ${action}.`;
        const missingSignoffs = Array.isArray(data.missingSignoffs)
          ? ` Missing signoffs: ${data.missingSignoffs.join(", ")}.`
          : "";
        setError(`${message}${missingSignoffs}`);
        return;
      }
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      setNotice(`Approval ${action === "approve" ? "approved" : "rejected"}.`);
      await load();
    } catch {
      setError(`Failed to ${action}.`);
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return <div className="space-y-4"><h1 className="text-2xl font-bold text-slate-100">Approvals</h1><p className="text-slate-400">Loading…</p></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Approvals</h1>
          <p className="mt-1 text-sm text-slate-400">Tiered change control for agents, runbooks, and league operations.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
          {approvals.length} pending
        </span>
      </div>
      {notice && (
        <div className="rounded-lg border border-emerald-600/40 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-600/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {approvals.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6 text-slate-400">
          No pending approvals. Run Season 0 Kickoff to generate Tier 2/3 proposals.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {approvals.map((a) => {
            const tierColor = TIER_COLORS[a.tier] ?? TIER_COLORS[1];
            const isActing = acting === a.id;
            return (
              <div
                key={a.id}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/65 to-slate-900/55 p-5 shadow-[0_12px_40px_rgba(2,8,23,0.55)]"
              >
                <div className="flex items-start gap-3">
                  <AgentAvatar name={a.agent?.name ?? "Commissioner"} department={a.agent?.department ?? "commissioner"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-100">{a.agent?.name ?? "Commissioner"}</span>
                      <span className="text-xs text-slate-500">@{a.agent?.department ?? "league"}</span>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" /> {timeAgo(a.createdAt)}
                      </span>
                      <span className={`ml-auto shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ring-1 ${tierColor}`}>
                        Tier {a.tier}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{TIER_LABELS[a.tier] ?? ""}</p>
                  </div>
                </div>

                <Link href={`/approvals/${a.id}`} className="mt-4 block text-sm font-semibold text-slate-100 hover:text-cyan-100">
                  {a.summary}
                </Link>

                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  {a.task ? <p>Task: <span className="text-slate-200">{a.task.title}</span></p> : null}
                  {a.proposal ? <p>Proposal: <span className="text-slate-200">{a.proposal.title}</span></p> : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    disabled={isActing}
                    onClick={() => act(a.id, "approve")}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100 transition hover:bg-emerald-400/25 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isActing ? "Working..." : "Approve"}
                  </button>
                  <button
                    disabled={isActing}
                    onClick={() => act(a.id, "reject")}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-300/35 bg-rose-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-400/25 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    {isActing ? "Working..." : "Reject"}
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
