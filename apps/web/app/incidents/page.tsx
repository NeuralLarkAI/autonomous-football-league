"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Incident = {
  id: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  sourceAgent: { id: string; name: string; department: string } | null;
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await fetch("/api/incidents");
    const data = await res.json();
    setIncidents(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <p className="text-slate-400">Loading incidents...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Incidents</h1>
      {incidents.length === 0 ? (
        <p className="rounded bg-slate-800/60 p-4 text-slate-400">No incidents.</p>
      ) : (
        <div className="space-y-2">
          {incidents.map((incident) => (
            <Link key={incident.id} href={`/incidents/${incident.id}`} className="block rounded bg-slate-800/60 p-4 hover:bg-slate-800">
              <p className="text-sm text-slate-200">
                [{incident.severity}] {incident.title}
              </p>
              <p className="text-xs text-slate-500">
                {incident.status} · {new Date(incident.createdAt).toLocaleString()} · {incident.sourceAgent?.name ?? "Unknown"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
