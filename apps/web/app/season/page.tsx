"use client";

import { useCallback, useEffect, useState } from "react";

type SeasonPhase = {
  id: string;
  seasonNumber: number;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: "PLANNED" | "ACTIVE" | "DONE";
};

export default function SeasonPage() {
  const [phases, setPhases] = useState<SeasonPhase[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/season/phases");
    const data = await res.json().catch(() => []);
    setPhases(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activate = async (id: string) => {
    setBusyId(id);
    const res = await fetch(`/api/season/phases/${id}/activate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Phase activated." : data.error ?? "Activation failed.");
    await load();
    setBusyId(null);
  };

  const nextPlanned = phases.find((p) => p.status === "PLANNED");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Season 0 Timeline</h1>
      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}
      {phases.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6 text-slate-400">
          No phases yet.
        </div>
      ) : (
        <div className="space-y-3">
          {phases.map((phase) => (
            <div key={phase.id} className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-100">{phase.name}</h2>
                <span className="rounded bg-slate-900 px-2 py-0.5 text-xs text-slate-300">{phase.status}</span>
              </div>
              <p className="mt-1 text-sm text-slate-300">{phase.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(phase.startDate).toLocaleDateString()} - {new Date(phase.endDate).toLocaleDateString()}
              </p>
              {phase.status !== "ACTIVE" && (
                <button
                  onClick={() => activate(phase.id)}
                  disabled={busyId === phase.id}
                  className="mt-2 rounded bg-blue-700 px-3 py-1.5 text-xs text-blue-100 disabled:opacity-50"
                >
                  {busyId === phase.id ? "Activating..." : "Activate Phase"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {nextPlanned && (
        <p className="text-xs text-slate-500">Next planned phase: {nextPlanned.name}</p>
      )}
    </div>
  );
}
