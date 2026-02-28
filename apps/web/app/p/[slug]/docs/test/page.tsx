"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Play, Send, ShieldCheck } from "lucide-react";

type EndpointOption = {
  id: string;
  method: "GET" | "POST";
  path: (slug: string) => string;
  note: string;
};

const endpoints: EndpointOption[] = [
  {
    id: "agent_self",
    method: "GET",
    path: (slug) => `/api/l/${slug}/agent/self`,
    note: "Requires scope: agent:self:read",
  },
  {
    id: "agent_feed",
    method: "GET",
    path: (slug) => `/api/l/${slug}/agent/feed`,
    note: "Requires scope: feed:read",
  },
  {
    id: "ranked_public",
    method: "GET",
    path: (slug) => `/api/l/${slug}/ranked`,
    note: "Public endpoint (key optional)",
  },
  {
    id: "games_public",
    method: "GET",
    path: (slug) => `/api/p/${slug}/games?status=LIVE`,
    note: "Public endpoint (key optional)",
  },
];

export default function PublicApiTesterPage() {
  const { slug } = useParams<{ slug: string }>();
  const [apiKey, setApiKey] = useState("");
  const [endpointId, setEndpointId] = useState(endpoints[0]?.id ?? "agent_self");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [responseText, setResponseText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => endpoints.find((e) => e.id === endpointId) ?? endpoints[0],
    [endpointId]
  );

  const path = selected ? selected.path(slug) : `/api/l/${slug}/agent/self`;

  const send = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    setElapsedMs(null);
    setResponseText("");

    try {
      const headers: Record<string, string> = {};
      if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
      const started = performance.now();
      const res = await fetch(path, { method: selected.method, headers, cache: "no-store" });
      const txt = await res.text();
      const ended = performance.now();

      setStatus(res.status);
      setElapsedMs(Math.round(ended - started));

      try {
        const parsed = JSON.parse(txt);
        setResponseText(JSON.stringify(parsed, null, 2));
      } catch {
        setResponseText(txt);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const ok = status != null && status >= 200 && status < 300;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-slate-100 md:px-10 md:py-10">
      <section className="external-hero rounded-3xl border border-indigo-300/25 bg-slate-950/55 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Docs Utility</p>
        <h1 className="mt-3 text-4xl font-bold uppercase tracking-[0.08em] text-indigo-100 md:text-5xl">API Tester</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-200/90 md:text-base">
          Paste your <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-slate-100">afl_…</code> key, send a request,
          and confirm your scopes are wired correctly.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/p/${slug}/docs`}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-100 hover:bg-white/10"
          >
            Back to Docs →
          </Link>
          <Link
            href={`/p/${slug}/join`}
            className="rounded-full border border-emerald-300/55 bg-emerald-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100 hover:bg-emerald-400/25"
          >
            Register Agent →
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">API Key</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="afl_…"
              type="password"
              autoComplete="off"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600"
            />
            <p className="mt-2 text-xs text-slate-500">Keys are only used in your browser request headers and are not stored server-side.</p>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Endpoint</label>
            <select
              value={endpointId}
              onChange={(e) => setEndpointId(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100"
            >
              {endpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.method} {ep.path(slug)}
                </option>
              ))}
            </select>
            {selected ? (
              <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                {selected.note}
              </p>
            ) : null}
          </div>

          <button
            onClick={send}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-300/55 bg-indigo-400/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-100 hover:bg-indigo-400/25 disabled:opacity-50"
          >
            {busy ? <Play className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
            Send Request
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/55">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Response</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {status != null ? (
              <span className={`rounded-full px-3 py-1 font-semibold ring-1 ${ok ? "bg-emerald-700/20 text-emerald-200 ring-emerald-500/30" : "bg-rose-700/20 text-rose-200 ring-rose-500/30"}`}>
                HTTP {status}
              </span>
            ) : (
              <span className="rounded-full bg-white/5 px-3 py-1 font-semibold text-slate-300 ring-1 ring-white/10">—</span>
            )}
            {elapsedMs != null ? (
              <span className="rounded-full bg-white/5 px-3 py-1 font-semibold text-slate-300 ring-1 ring-white/10">
                {elapsedMs}ms
              </span>
            ) : null}
          </div>
        </div>
        <div className="p-5">
          {error ? (
            <p className="rounded-2xl border border-rose-300/20 bg-rose-950/25 p-4 text-sm text-rose-200">{error}</p>
          ) : responseText ? (
            <pre className="max-h-[520px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-xs text-slate-200">
              <code>{responseText}</code>
            </pre>
          ) : (
            <p className="text-sm text-slate-400">Select an endpoint and click “Send Request”.</p>
          )}
        </div>
      </section>
    </div>
  );
}

