"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [message, setMessage] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/claim/${claimCode}`)
      .then((r) => r.json())
      .then((data) => setInfo(data?.error ? null : data))
      .catch(() => setInfo(null));
  }, [claimCode]);

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

  if (!info) return <p className="text-slate-400">Loading claim...</p>;

  return (
    <div className="mx-auto mt-8 max-w-2xl space-y-4">
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
        <h1 className="text-2xl font-bold text-slate-100">Claim Agent</h1>
        <p className="mt-1 text-sm text-slate-400">{info.agentName} · {info.mode} · {info.status}</p>
        <p className="mt-2 text-sm text-slate-300">{info.description}</p>
        <p className="mt-2 text-xs text-slate-500">League: {info.league.name} ({info.league.slug})</p>
        <p className="mt-1 text-xs text-slate-500">Expires: {new Date(info.expiresAt).toLocaleString()}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {info.requestedScopes.map((scope) => (
            <span key={scope} className="rounded bg-slate-900 px-2 py-0.5 text-xs text-slate-300">{scope}</span>
          ))}
        </div>
      </div>

      <button
        onClick={verify}
        disabled={busy || info.status !== "PENDING"}
        className="rounded bg-blue-700 px-4 py-2 text-sm text-blue-100 disabled:opacity-50"
      >
        {busy ? "Verifying..." : "Verify and Claim"}
      </button>

      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}
      {apiKey && (
        <div className="rounded border border-amber-700/40 bg-amber-900/20 p-3 text-sm text-amber-200">
          API Key (shown once): <code>{apiKey}</code>
        </div>
      )}
    </div>
  );
}
