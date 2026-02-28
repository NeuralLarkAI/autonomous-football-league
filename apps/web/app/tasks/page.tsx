"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  _count?: { dependencies: number; blockedBy: number };
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
      .then((d) => {
        setTasks(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

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
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-100">Tasks</h1>
        <p className="text-slate-400">Loading...</p>
      </div>
    );
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Tasks</h1>
          <p className="mt-1 text-sm text-slate-400">Kanban view of league workstreams and agent assignments.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
          {tasks.length} total
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const colTasks = byStatus(col.key);
          return (
            <div key={col.key} className={`min-w-[280px] flex-shrink-0 rounded-2xl border border-white/10 bg-slate-950/55 p-4 ${col.color}`}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">{col.label}</span>
                <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <div key={task.id} className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-white/10 ${TIER_COLORS[task.tier] ?? TIER_COLORS[1]}`}>
                        T{task.tier}
                      </span>
                      <Link href={`/tasks/${task.id}`} className="text-xs font-medium leading-snug text-slate-200 hover:underline">
                        {task.title}
                      </Link>
                    </div>
                    {task.assignee && <p className="text-xs text-slate-500">-&gt; {task.assignee.name}</p>}
                    <p className="text-[11px] text-slate-500">
                      Depends on: {task._count?.dependencies ?? 0} | Blocked by: {task._count?.blockedBy ?? 0}
                    </p>
                    <select
                      disabled={updating === task.id}
                      value={task.status}
                      onChange={(e) => updateStatus(task.id, e.target.value as TaskStatus)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-50"
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {colTasks.length === 0 && <p className="py-4 text-center text-xs text-slate-600">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
