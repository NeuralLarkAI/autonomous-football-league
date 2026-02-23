"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type TaskDetail = {
  id: string;
  title: string;
  description: string;
  status: string;
  tier: number;
  department: string;
  acceptanceCriteria: string;
  riskNotes: string;
  testPlan: string;
  rollbackPlan: string;
  signoffs: string;
  dependencies: Array<{
    dependsOnTask: { id: string; title: string; status: string; tier: number };
  }>;
  blockedBy: Array<{
    task: { id: string; title: string; status: string; tier: number };
  }>;
};

type TaskLite = { id: string; title: string; status: string; tier: number };

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [allTasks, setAllTasks] = useState<TaskLite[]>([]);
  const [dependsOnTaskId, setDependsOnTaskId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [taskRes, allRes] = await Promise.all([fetch(`/api/tasks/${id}`), fetch("/api/tasks")]);
    const [taskData, allData] = await Promise.all([taskRes.json(), allRes.json()]);
    setTask(taskRes.ok ? taskData : null);
    setAllTasks(Array.isArray(allData) ? allData : []);
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const availableTasks = useMemo(() => {
    if (!task) return [];
    const existing = new Set(task.dependencies.map((d) => d.dependsOnTask.id));
    return allTasks.filter((t) => t.id !== task.id && !existing.has(t.id));
  }, [task, allTasks]);

  const addDependency = async () => {
    if (!dependsOnTaskId) return;
    const res = await fetch(`/api/tasks/${id}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dependsOnTaskId }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Dependency added." : data.error ?? "Failed to add dependency.");
    setDependsOnTaskId("");
    await load();
  };

  const removeDependency = async (depTaskId: string) => {
    const res = await fetch(`/api/tasks/${id}/dependencies`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dependsOnTaskId: depTaskId }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Dependency removed." : data.error ?? "Failed to remove dependency.");
    await load();
  };

  if (!task) return <p className="text-slate-400">Loading task...</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{task.department}</p>
        <h1 className="text-3xl font-bold text-slate-100">{task.title}</h1>
        <p className="text-slate-400">
          Tier {task.tier} - {task.status}
        </p>
      </div>

      {message && <p className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="mb-2 font-semibold text-slate-200">Depends On</h2>
          {task.dependencies.length === 0 ? (
            <p className="text-sm text-slate-500">No dependencies.</p>
          ) : (
            <div className="space-y-2">
              {task.dependencies.map((dep) => (
                <div key={dep.dependsOnTask.id} className="flex items-center justify-between rounded bg-slate-900/60 px-3 py-2">
                  <Link href={`/tasks/${dep.dependsOnTask.id}`} className="text-sm text-slate-200 hover:underline">
                    [{dep.dependsOnTask.status}] T{dep.dependsOnTask.tier} {dep.dependsOnTask.title}
                  </Link>
                  <button
                    onClick={() => removeDependency(dep.dependsOnTask.id)}
                    className="rounded bg-red-800/60 px-2 py-1 text-xs text-red-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <select
              value={dependsOnTaskId}
              onChange={(e) => setDependsOnTaskId(e.target.value)}
              className="flex-1 rounded bg-slate-900 px-2 py-1 text-sm text-slate-200"
            >
              <option value="">Select task dependency...</option>
              {availableTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.status}] T{t.tier} {t.title}
                </option>
              ))}
            </select>
            <button onClick={addDependency} className="rounded bg-blue-700 px-3 py-1 text-sm text-blue-100">
              Attach
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <h2 className="mb-2 font-semibold text-slate-200">Blocked By</h2>
          {task.blockedBy.length === 0 ? (
            <p className="text-sm text-slate-500">No tasks currently blocked by this task.</p>
          ) : (
            <div className="space-y-2">
              {task.blockedBy.map((dep) => (
                <Link
                  key={dep.task.id}
                  href={`/tasks/${dep.task.id}`}
                  className="block rounded bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:underline"
                >
                  [{dep.task.status}] T{dep.task.tier} {dep.task.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="mb-2 font-semibold text-slate-200">Execution Plan</h2>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-slate-400">Description</p>
            <p className="text-slate-200 whitespace-pre-wrap">{task.description || "No description"}</p>
          </div>
          <div>
            <p className="text-slate-400">Acceptance Criteria</p>
            <p className="text-slate-200 whitespace-pre-wrap">{task.acceptanceCriteria || "Not set"}</p>
          </div>
          <div>
            <p className="text-slate-400">Risk Notes</p>
            <p className="text-slate-200 whitespace-pre-wrap">{task.riskNotes || "Not set"}</p>
          </div>
          <div>
            <p className="text-slate-400">Test Plan</p>
            <p className="text-slate-200 whitespace-pre-wrap">{task.testPlan || "Not set"}</p>
          </div>
          <div>
            <p className="text-slate-400">Rollback Plan</p>
            <p className="text-slate-200 whitespace-pre-wrap">{task.rollbackPlan || "Not set"}</p>
          </div>
          <div>
            <p className="text-slate-400">Signoffs</p>
            <p className="text-slate-200 whitespace-pre-wrap">{task.signoffs || "[]"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
