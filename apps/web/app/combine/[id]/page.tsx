"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ScenarioResult = {
  id: string;
  scenarioKey: string;
  passed: boolean;
  latencyMs: number;
  outputJson: string;
  score: number;
  errorText: string;
};

type CombineRunDetail = {
  id: string;
  runType: string;
  status: string;
  seed: number;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number;
  scoreOverall: number;
  scoreLatency: number;
  scoreReliability: number;
  notes: string;
  createdAt: string;
  agent: { id: string; name: string; department: string };
  scenarioResults: ScenarioResult[];
};

export default function CombineRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<CombineRunDetail | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/combine/runs/${id}`);
    const data = await res.json().catch(() => null);
    setRun(res.ok ? data : null);
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  if (!run) return <p className="text-slate-400">Loading combine run...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{run.agent.name} - {run.runType} Run</h1>
        <p className="text-sm text-slate-500">
          {run.status} · Seed {run.seed} · {new Date(run.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">Overall</p>
          <p className="text-xl font-semibold text-slate-100">{run.scoreOverall}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">Reliability</p>
          <p className="text-xl font-semibold text-slate-100">{run.scoreReliability}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">Latency</p>
          <p className="text-xl font-semibold text-slate-100">{run.scoreLatency}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">Duration</p>
          <p className="text-xl font-semibold text-slate-100">{run.durationMs}ms</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="mb-2 font-semibold text-slate-200">Scenario Results</h2>
        <div className="space-y-2">
          {run.scenarioResults.map((result) => (
            <div key={result.id} className="rounded bg-slate-900/70 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-200">{result.scenarioKey}</p>
                <span className={`text-xs ${result.passed ? "text-green-400" : "text-red-400"}`}>
                  {result.passed ? "PASS" : "FAIL"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Score {result.score} | Latency {result.latencyMs}ms
              </p>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-950/70 p-2 text-xs text-slate-300">
                {result.outputJson}
              </pre>
              {result.errorText && <p className="mt-2 text-xs text-red-400">{result.errorText}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
