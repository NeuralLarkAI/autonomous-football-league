"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, CheckCircle2, Clock, Copy, KeyRound } from "lucide-react";

type ClaimInfo = {
  claimCode: string;
  agentName: string;
  description: string;
  requestedScopes: string[];
  status: string;
  mode: string;
  expiresAt: string;
  league: { id: string; name: string; slug: string };
};

export default function ClaimCodePage() {
  const { claimCode } = useParams<{ claimCode: string }>();
  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const status = info?.status ?? null;
  const [message, setMessage] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [pollSecondsLeft, setPollSecondsLeft] = useState<number>(30);
  const [justApproved, setJustApproved] = useState(false);
  const [polling, setPolling] = useState(false);

  const refreshInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/claim/${claimCode}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!data || data?.error) {
        setInfo(null);
        return;
      }
      setInfo((prev) => {
        if (prev?.status === "PENDING" && data.status === "APPROVED") {
          setJustApproved(true);
          setTimeout(() => setJustApproved(false), 1500);
          setMessage("Approved ✓ You can verify & claim your API key now.");
        }
        return data as ClaimInfo;
      });
    } catch {
      setInfo(null);
    }
  }, [claimCode]);

  useEffect(() => {
    refreshInfo();
  }, [refreshInfo]);

  useEffect(() => {
    if (!status || status !== "PENDING") {
      setPolling(false);
      return;
    }

    setPolling(true);
    setPollSecondsLeft(30);

    const countdown = setInterval(() => {
      setPollSecondsLeft((s) => (s <= 1 ? 30 : s - 1));
    }, 1000);

    const poll = setInterval(() => {
      refreshInfo();
    }, 30_000);

    return () => {
      clearInterval(countdown);
      clearInterval(poll);
      setPolling(false);
    };
  }, [claimCode, refreshInfo, status]);

  const copyText = async (text: string, which: "code" | "key") => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "code") {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      }
    } catch {
      setMessage("Copy failed. Your browser may block clipboard access.");
    }
  };

  const verify = async () => {
    setBusy(true);
    const res = await fetch("/api/claim/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimCode, proofType: "MANUAL", proofValue: "verified by commissioner" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(`Claim verified. Agent: ${data.agent.name}`);
      setApiKey(data.apiKey?.key ?? null);
    } else {
      setMessage(data.error ?? "Verification failed.");
    }
    setBusy(false);
  };

  const queueApproval = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/claim/queue-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Failed to queue approval.");
        return;
      }
      if (typeof data.approvalUrl === "string") setApprovalUrl(data.approvalUrl);
      setMessage("Commissioner approval queued. Open the approvals link and approve to continue.");
    } finally {
      setBusy(false);
    }
  };

  if (!info) return <p className="text-slate-400">Loading claim...</p>;

  const claimable = info.status === "APPROVED";
  const statusMeta = (() => {
    if (info.status === "PENDING")
      return {
        label: "PENDING",
        cls: "bg-amber-600/15 text-amber-200 ring-amber-500/30",
        icon: Clock,
        desc: "Awaiting commissioner review. Check back in 24–48 hours.",
      };
    if (info.status === "APPROVED")
      return {
        label: "APPROVED",
        cls: "bg-emerald-700/15 text-emerald-200 ring-emerald-500/30",
        icon: BadgeCheck,
        desc: "Ready to claim! Log in and click Verify & Claim below.",
      };
    if (info.status === "EXPIRED")
      return {
        label: "EXPIRED",
        cls: "bg-rose-700/15 text-rose-200 ring-rose-500/30",
        icon: AlertTriangle,
        desc: "This code has expired. Return to the join page to register again.",
      };
    if (info.status === "CLAIMED")
      return {
        label: "CLAIMED",
        cls: "bg-cyan-700/15 text-cyan-200 ring-cyan-500/30",
        icon: CheckCircle2,
        desc: "Already claimed. Contact a commissioner if you've lost your key.",
      };
    return {
      label: info.status,
      cls: "bg-slate-700/20 text-slate-200 ring-white/10",
      icon: Clock,
      desc: "Status unknown.",
    };
  })();
  const StatusIcon = statusMeta.icon;

  return (
    <div className="mx-auto mt-8 max-w-2xl space-y-4 px-4 pb-12 text-slate-100">
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Claim Agent</h1>
            <p className="mt-1 text-sm text-slate-300">
              <span className="font-semibold text-slate-100">{info.agentName}</span>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-300">{info.mode}</span>
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
              justApproved ? "ring-emerald-300/70 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" : ""
            } ${statusMeta.cls}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {statusMeta.label}
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-300">{info.description}</p>
        <p className="mt-3 text-xs text-slate-500">
          League: {info.league.name} ({info.league.slug})
        </p>
        <p className="mt-1 text-xs text-slate-500">Expires: {new Date(info.expiresAt).toLocaleString()}</p>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Claim Code</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <code className="rounded bg-slate-950/60 px-3 py-1 font-mono text-sm text-slate-100">{info.claimCode}</code>
            <button
              onClick={() => copyText(info.claimCode, "code")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedCode ? "Copied ✓" : "Copy Code"}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Requested Scopes</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {info.requestedScopes.map((scope) => (
              <span
                key={scope}
                className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-[11px] font-semibold text-slate-200"
              >
                {scope}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
          {statusMeta.desc}
          {polling ? <p className="mt-2 text-xs text-slate-400">Auto-checking status in {pollSecondsLeft}s…</p> : null}
          {info.status === "EXPIRED" ? (
            <div className="mt-3">
              <Link
                href={`/p/${info.league.slug}/join`}
                className="inline-flex rounded-full border border-amber-300/45 bg-amber-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100 hover:bg-amber-400/25"
              >
                Return to Join Page →
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {!claimable && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={queueApproval}
            disabled={busy || info.status !== "PENDING"}
            className="rounded bg-slate-700 px-4 py-2 text-sm text-slate-100 disabled:opacity-50"
          >
            {busy ? "Working..." : "Queue Commissioner Approval"}
          </button>
          {approvalUrl && (
            <a className="rounded bg-emerald-700 px-4 py-2 text-sm text-emerald-100" href={approvalUrl}>
              Open Approvals
            </a>
          )}
        </div>
      )}

      <button
        onClick={verify}
        disabled={busy || !claimable}
        className="rounded bg-blue-700 px-4 py-2 text-sm text-blue-100 disabled:opacity-50"
      >
        {busy ? "Verifying..." : "Verify and Claim"}
      </button>

      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}
      {apiKey && (
        <div className="rounded-2xl border border-amber-700/40 bg-amber-900/20 p-4 text-sm text-amber-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 font-semibold uppercase tracking-[0.14em] text-amber-200">
              <KeyRound className="h-4 w-4" />
              API Key (shown once)
            </p>
            <button
              onClick={() => copyText(apiKey, "key")}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/20"
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedKey ? "Copied ✓" : "Copy Key"}
            </button>
          </div>
          <code className="mt-3 block overflow-x-auto rounded-xl bg-slate-950/60 p-3 font-mono text-xs text-amber-100">
            {apiKey}
          </code>
        </div>
      )}
    </div>
  );
}
