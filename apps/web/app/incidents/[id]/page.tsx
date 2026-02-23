"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Incident = {
  id: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  sourceAgent: { id: string; name: string; department: string } | null;
};

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/incidents/${id}`);
    const data = await res.json();
    setIncident(res.ok ? data : null);
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const resolve = async () => {
    const res = await fetch(`/api/incidents/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolutionNote: note }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Incident resolved." : data.error ?? "Resolve failed.");
    await load();
  };

  if (!incident) return <p className="text-slate-400">Loading incident...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-slate-100">{incident.title}</h1>
      <p className="text-slate-400">
        [{incident.severity}] {incident.status}
      </p>
      <p className="text-slate-200 whitespace-pre-wrap">{incident.description}</p>
      <p className="text-xs text-slate-500">
        Created: {new Date(incident.createdAt).toLocaleString()} - Source: {incident.sourceAgent?.name ?? "Unknown"}
      </p>
      {incident.resolvedAt && <p className="text-xs text-green-400">Resolved: {new Date(incident.resolvedAt).toLocaleString()}</p>}

      {incident.status !== "RESOLVED" && (
        <div className="space-y-2 rounded border border-slate-700/50 bg-slate-800/60 p-3">
          <p className="text-sm text-slate-300">Resolve incident</p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="resolution note"
            className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200"
          />
          <button onClick={resolve} className="rounded bg-green-700 px-3 py-2 text-sm text-green-100">
            Mark Resolved
          </button>
        </div>
      )}
      {message && <p className="text-sm text-slate-300">{message}</p>}
    </div>
  );
}
