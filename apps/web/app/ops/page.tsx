"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type FeedEvent = {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
  agent: { name: string } | null;
};

type Incident = {
  id: string;
  severity: string;
  title: string;
  status: string;
  createdAt: string;
};

type Health = {
  runErrorRate24h: number;
  avgRunDurationMs24h: number;
  taskThroughput7d: { created: number; completed: number };
  approvalBacklogByTier: Record<string, number>;
  openIncidents: number;
};

const ALERT_TYPES = new Set(["REJECTED", "SEASON_LOCK", "DEFERRED", "INCIDENT_CREATED", "INCIDENT_RESOLVED"]);

function isAlert(ev: FeedEvent) {
  return ALERT_TYPES.has(ev.type);
}

export default function OpsPage() {
  const pathname = usePathname();
  const leagueSlug = pathname.split("/")[2] || "afl-prime";
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [eventsRes, incidentsRes, healthRes] = await Promise.all([
      fetch("/api/feed?limit=100"),
      fetch("/api/incidents"),
      fetch("/api/ops/health"),
    ]);
    const [eventsData, incidentsData, healthData] = await Promise.all([
      eventsRes.json(),
      incidentsRes.json(),
      healthRes.json(),
    ]);

    setEvents(Array.isArray(eventsData) ? eventsData : []);
    setIncidents(Array.isArray(incidentsData) ? incidentsData : []);
    setHealth(healthRes.ok ? healthData : null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const resolveIncident = async (id: string) => {
    await fetch(`/api/incidents/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolutionNote: "Resolved from Ops panel" }),
    });
    await load();
  };

  const alerts = events.filter(isAlert);
  const deployLog = events.filter((e) => ["KICKOFF", "SEED", "SEASON_LOCK"].includes(e.type));

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-100">Ops</h1>
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Ops</h1>
        <Link href={`/l/${leagueSlug}/ops/abuse`} className="rounded bg-red-700 px-3 py-1.5 text-xs text-red-100">
          Abuse Panel
        </Link>
      </div>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <p className="text-xs text-slate-400">Run Error Rate (24h)</p>
          <p className="text-2xl font-bold text-slate-100">{((health?.runErrorRate24h ?? 0) * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <p className="text-xs text-slate-400">Avg Run Duration</p>
          <p className="text-2xl font-bold text-slate-100">{health?.avgRunDurationMs24h ?? 0} ms</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <p className="text-xs text-slate-400">Task Throughput (7d)</p>
          <p className="text-2xl font-bold text-slate-100">
            {health?.taskThroughput7d.completed ?? 0}/{health?.taskThroughput7d.created ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <p className="text-xs text-slate-400">Approval Backlog</p>
          <p className="text-sm text-slate-200">T1 {health?.approvalBacklogByTier?.["1"] ?? 0} ? T2 {health?.approvalBacklogByTier?.["2"] ?? 0} ? T3 {health?.approvalBacklogByTier?.["3"] ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <p className="text-xs text-slate-400">Open Incidents</p>
          <p className="text-2xl font-bold text-slate-100">{health?.openIncidents ?? 0}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Incidents</h2>
        {incidents.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-800/40 rounded-xl p-4">No incidents.</p>
        ) : (
          <div className="space-y-2">
            {incidents.map((incident) => (
              <div key={incident.id} className="flex items-center justify-between rounded-xl border border-slate-700/40 bg-slate-800/50 p-3">
                <div>
                  <Link href={`/incidents/${incident.id}`} className="text-sm text-slate-200 hover:underline">
                    [{incident.severity}] {incident.title}
                  </Link>
                  <p className="text-xs text-slate-500">{incident.status} ? {new Date(incident.createdAt).toLocaleString()}</p>
                </div>
                {incident.status !== "RESOLVED" && (
                  <button onClick={() => resolveIncident(incident.id)} className="rounded bg-green-700 px-2 py-1 text-xs text-green-100">
                    Resolve
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Integrity Alerts ({alerts.length})</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-800/40 rounded-xl p-4">No alerts. All clear.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 rounded-xl border border-red-800/40 bg-red-900/10 p-3">
                <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-300">{ev.type.replace(/_/g, " ")}</span>
                <div className="flex-1">
                  <p className="text-sm text-slate-200">{ev.summary}</p>
                  {ev.agent && <p className="text-xs text-slate-500 mt-0.5">{ev.agent.name}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-500">{new Date(ev.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Deploy Log ({deployLog.length})</h2>
        {deployLog.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-800/40 rounded-xl p-4">No deploy events yet.</p>
        ) : (
          <div className="space-y-2">
            {deployLog.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 rounded-xl border border-slate-700/40 bg-slate-800/50 p-3">
                <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-slate-500/20 text-slate-300">{ev.type.replace(/_/g, " ")}</span>
                <p className="flex-1 text-sm text-slate-200">{ev.summary}</p>
                <span className="shrink-0 text-xs text-slate-500">{new Date(ev.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
