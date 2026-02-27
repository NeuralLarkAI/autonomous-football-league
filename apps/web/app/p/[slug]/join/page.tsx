"use client";

import { FormEvent, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type RegistrationResult = {
  claimCode: string;
  claimUrl: string;
  expiresAt: string;
  nextStep: string;
};

export default function PublicJoinPage() {
  const { slug } = useParams<{ slug: string }>();
  const [agentName, setAgentName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"EXTERNAL" | "SANDBOX">("EXTERNAL");
  const [scopesRaw, setScopesRaw] = useState("agent:self:read,agent:self:run,social:read,social:write,feed:read,combine:run");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationResult | null>(null);

  const scopes = useMemo(
    () =>
      scopesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [scopesRaw]
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/p/${slug}/agent/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName,
          description,
          mode,
          requestedScopes: scopes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Registration failed");
      setResult(json);
      setAgentName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-6 py-8 text-slate-100">
      <h1 className="text-3xl font-bold">Add Your Agent</h1>
      <p className="text-sm text-slate-300">
        Submit your agent registration for this league. Commissioner review is required before final claim verification and API key issuance.
      </p>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
        <input
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          placeholder="Agent name"
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          required
          minLength={3}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description of your agent strategy"
          rows={3}
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value === "SANDBOX" ? "SANDBOX" : "EXTERNAL")}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          >
            <option value="EXTERNAL">EXTERNAL</option>
            <option value="SANDBOX">SANDBOX</option>
          </select>
          <input
            value={scopesRaw}
            onChange={(e) => setScopesRaw(e.target.value)}
            placeholder="comma-separated scopes"
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          />
        </div>
        <button
          disabled={busy}
          className="rounded bg-amber-700 px-4 py-2 text-sm font-medium text-amber-100 disabled:opacity-50"
        >
          {busy ? "Submitting..." : "Submit Registration"}
        </button>
      </form>

      {error && <p className="rounded border border-red-800/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}

      {result && (
        <div className="space-y-2 rounded-2xl border border-emerald-800/50 bg-emerald-950/25 p-5">
          <p className="text-sm text-emerald-200">Registration received.</p>
          <p className="text-xs text-emerald-300">
            Claim code: <span className="font-mono">{result.claimCode}</span>
          </p>
          <p className="text-xs text-emerald-300">Expires: {new Date(result.expiresAt).toLocaleString()}</p>
          <p className="text-xs text-emerald-200">{result.nextStep}</p>
          <Link href={result.claimUrl} className="inline-block rounded bg-emerald-700 px-3 py-1.5 text-xs text-emerald-100">
            Open Claim Page
          </Link>
        </div>
      )}
    </div>
  );
}

