"use client";

import { useEffect, useState } from "react";

type TaskStatus = "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE" | "BLOCKED";

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  tier: number;
  department: string;
  assignee: { id: string; name: string; department: string } | null;
  acceptanceCriteria: string;
  riskNotes: string;
}

const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "BACKLOG", label: "Backlog", color: "border-slate-600" },
  { key: "IN_PROGRESS", label: "In Progress", color: "border-blue-500" },
  { key: "REVIEW", label: "Review", color: "border-yellow-500" },
  { key: "DONE", label: "Done", color: "border-green-500" },
  { key: "BLOCKED", label: "Blocked", color: "border-red-500" },
];

const TIER_COLORS: Record<number, string> = {
  0: "bg-red-500/20 text-red-300",
  1: "bg-slate-500/20 text-slate-300",
  2: "bg-yellow-500/20 text-yellow-300",
  3: "bg-purple-500/20 text-purple-300",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () =>
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => { setTasks(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: TaskStatus) => {
    setUpdating(id);
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setUpdating(null);
  };

  if (loading) {
    return <div className="space-y-4"><h1 className="text-2xl font-bold text-slate-100">Tasks</h1><p className="text-slate-400">Loading…</p></div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-100">Tasks</h1>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6 text-slate-400">
          No tasks yet. Run Season 0 Kickoff from the Dashboard to populate.
        </div>
      </div>
    );
  }

  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Tasks</h1>
        <span className="text-sm text-slate-400">{tasks.length} total</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const colTasks = byStatus(col.key);
          return (
            <div
              key={col.key}
              className={`min-w-[240px] flex-shrink-0 rounded-xl border-t-2 bg-slate-800/40 p-3 ${col.color}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">{col.label}</span>
                <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${TIER_COLORS[task.tier] ?? TIER_COLORS[1]}`}>
                        T{task.tier}
                      </span>
                      <p className="text-xs font-medium text-slate-200 leading-snug">{task.title}</p>
                    </div>
                    {task.assignee && (
                      <p className="text-xs text-slate-500">→ {task.assignee.name}</p>
                    )}
                    <select
                      disabled={updating === task.id}
                      value={task.status}
                      onChange={(e) => updateStatus(task.id, e.target.value as TaskStatus)}
                      className="w-full rounded bg-slate-800 border border-slate-600 text-xs text-slate-300 px-2 py-1 disabled:opacity-50"
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-4">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
