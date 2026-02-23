"use client";

import { useEffect, useState } from "react";

interface FeedEvent {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
  agent: { name: string } | null;
}

const ALERT_TYPES = new Set(["REJECTED", "SEASON_LOCK", "DEFERRED"]);
const INTEGRITY_KEYWORDS = ["tamper", "alert", "breach", "violation", "deferred", "blocked", "rejected"];

function isAlert(ev: FeedEvent) {
  return (
    ALERT_TYPES.has(ev.type) ||
    INTEGRITY_KEYWORDS.some((kw) => ev.summary.toLowerCase().includes(kw))
  );
}

export default function OpsPage() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    fetch("/api/feed?limit=100")
      .then((r) => r.json())
      .then((d) => { setEvents(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const alerts = events.filter(isAlert);
  const deployLog = events.filter((e) => ["KICKOFF", "SEED", "SEASON_LOCK"].includes(e.type));

  if (loading) {
    return <div className="space-y-4"><h1 className="text-2xl font-bold text-slate-100">Ops</h1><p className="text-slate-400">Loading…</p></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Ops</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
          Integrity Alerts ({alerts.length})
        </h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-800/40 rounded-xl p-4">No alerts. All clear.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 rounded-xl border border-red-800/40 bg-red-900/10 p-3">
                <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-300">
                  {ev.type.replace(/_/g, " ")}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-slate-200">{ev.summary}</p>
                  {ev.agent && <p className="text-xs text-slate-500 mt-0.5">{ev.agent.name}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-500">
                  {new Date(ev.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Deploy Log ({deployLog.length})
        </h2>
        {deployLog.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-800/40 rounded-xl p-4">No deploy events yet.</p>
        ) : (
          <div className="space-y-2">
            {deployLog.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 rounded-xl border border-slate-700/40 bg-slate-800/50 p-3">
                <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-slate-500/20 text-slate-300">
                  {ev.type.replace(/_/g, " ")}
                </span>
                <p className="flex-1 text-sm text-slate-200">{ev.summary}</p>
                <span className="shrink-0 text-xs text-slate-500">
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
