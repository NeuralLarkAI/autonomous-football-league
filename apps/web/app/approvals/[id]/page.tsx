"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ApprovalDetail = {
  id: string;
  tier: number;
  summary: string;
  status: string;
  proposal: null | {
    id: string;
    title: string;
    summary: string;
    status: string;
    beforeJson: string;
    afterJson: string;
    requiredSignoffs: string;
    signoffs: Array<{
      id: string;
      agentId: string;
      status: string;
      comment: string;
      agent: { id: string; name: string; department: string };
    }>;
    reviewRequests: Array<{
      id: string;
      note: string;
      status: string;
      createdAt: string;
      requesterAgent: { id: string; name: string } | null;
      targetAgent: { id: string; name: string } | null;
    }>;
  };
};

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export default function ApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [approval, setApproval] = useState<ApprovalDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/approvals/${id}`);
    const data = await res.json();
    setApproval(res.ok ? data : null);
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const beforeObj = useMemo(() => parseJson(approval?.proposal?.beforeJson ?? "{}"), [approval]);
  const afterObj = useMemo(() => parseJson(approval?.proposal?.afterJson ?? "{}"), [approval]);

  const diffRows = useMemo(() => {
    const keys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));
    return keys.map((key) => ({
      key,
      before: beforeObj[key],
      after: afterObj[key],
      changed: JSON.stringify(beforeObj[key]) !== JSON.stringify(afterObj[key]),
    }));
  }, [beforeObj, afterObj]);

  const runAction = async (action: "approve" | "reject" | "defer") => {
    setActing(true);
    const res = await fetch(`/api/approvals/${id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Approval ${action}d.` : data.error ?? `Failed to ${action}.`);
    await load();
    setActing(false);
  };

  const requestReview = async () => {
    setActing(true);
    const res = await fetch(`/api/approvals/${id}/request-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requesterAgentId: "commissioner",
        targetAgentId: reviewTarget || undefined,
        note: reviewNote,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Review requested." : data.error ?? "Request review failed.");
    setReviewTarget("");
    setReviewNote("");
    await load();
    setActing(false);
  };

  if (!approval) return <p className="text-slate-400">Loading approval...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Approval {approval.id.slice(-6)}</h1>
        <p className="text-slate-400">
          Tier {approval.tier} - {approval.status}
        </p>
        <p className="mt-1 text-slate-200">{approval.summary}</p>
      </div>

      {message && <p className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <button disabled={acting} onClick={() => runAction("approve")} className="rounded bg-green-700 px-3 py-2 text-sm text-green-100 disabled:opacity-50">
          Approve
        </button>
        <button disabled={acting} onClick={() => runAction("reject")} className="rounded bg-red-700 px-3 py-2 text-sm text-red-100 disabled:opacity-50">
          Reject
        </button>
        <button disabled={acting} onClick={() => runAction("defer")} className="rounded bg-amber-700 px-3 py-2 text-sm text-amber-100 disabled:opacity-50">
          Deferred to Offseason
        </button>
      </div>

      {approval.proposal && (
        <>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
            <h2 className="mb-2 font-semibold text-slate-200">Proposal Diff</h2>
            <div className="space-y-2">
              {diffRows.map((row) => (
                <div
                  key={row.key}
                  className={`grid grid-cols-3 gap-2 rounded px-2 py-1 text-sm ${
                    row.changed ? "bg-yellow-900/20" : "bg-slate-900/40"
                  }`}
                >
                  <p className="text-slate-300">{row.key}</p>
                  <p className="text-slate-400">{JSON.stringify(row.before)}</p>
                  <p className="text-slate-200">{JSON.stringify(row.after)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
            <h2 className="mb-2 font-semibold text-slate-200">Required Signoffs</h2>
            <div className="space-y-2">
              {approval.proposal.signoffs.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded bg-slate-900/60 px-3 py-2 text-sm">
                  <p className="text-slate-200">
                    {s.agent.name} ({s.agent.department})
                  </p>
                  <span className="text-slate-400">{s.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
            <h2 className="mb-2 font-semibold text-slate-200">Request Review</h2>
            <div className="grid gap-2 md:grid-cols-[1fr,2fr,auto]">
              <input
                value={reviewTarget}
                onChange={(e) => setReviewTarget(e.target.value)}
                placeholder="targetAgentId (optional)"
                className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200"
              />
              <input
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="review note"
                className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200"
              />
              <button onClick={requestReview} disabled={acting} className="rounded bg-blue-700 px-3 py-1 text-sm text-blue-100 disabled:opacity-50">
                Request
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {approval.proposal.reviewRequests.map((r) => (
                <div key={r.id} className="rounded bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
                  <p>{r.note || "No note"}</p>
                  <p className="text-xs text-slate-500">
                    {r.requesterAgent?.name ?? "Unknown"} {"->"} {r.targetAgent?.name ?? "Unassigned"} ({r.status})
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
