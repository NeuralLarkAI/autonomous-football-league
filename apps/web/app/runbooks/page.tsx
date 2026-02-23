"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Runbook = {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  cron: string | null;
  actionType: string;
  actionPayloadJson: string;
  isEnabled: boolean;
  ownerAgent: { id: string; name: string } | null;
  runs: Array<{
    id: string;
    status: string;
    createdAt: string;
    outputSummary: string;
  }>;
};

type Agent = { id: string; name: string };

export default function RunbooksPage() {
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerAgentId, setOwnerAgentId] = useState("");
  const [actionType, setActionType] = useState("RUN_AGENT");
  const [payload, setPayload] = useState("{\"agentId\":\"integrity\"}");
  const [triggerType, setTriggerType] = useState("MANUAL");
  const [cron, setCron] = useState("");

  const load = useCallback(async () => {
    const [runbooksRes, agentsRes] = await Promise.all([fetch("/api/runbooks"), fetch("/api/agents")]);
    const [runbooksData, agentsData] = await Promise.all([runbooksRes.json(), agentsRes.json()]);
    setRunbooks(Array.isArray(runbooksData) ? runbooksData : []);
    setAgents(Array.isArray(agentsData) ? agentsData : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runNow = async (id: string) => {
    setBusy(id);
    const res = await fetch(`/api/runbooks/${id}/run`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Runbook completed." : data.error ?? "Runbook failed.");
    await load();
    setBusy(null);
  };

  const toggleEnabled = async (id: string, isEnabled: boolean) => {
    setBusy(id);
    const res = await fetch(`/api/runbooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !isEnabled }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Runbook ${!isEnabled ? "enabled" : "disabled"}.` : data.error ?? "Update failed.");
    await load();
    setBusy(null);
  };

  const createRunbook = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("create");
    const res = await fetch("/api/runbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        ownerAgentId: ownerAgentId || undefined,
        triggerType,
        cron: triggerType === "SCHEDULED" ? cron : undefined,
        actionType,
        actionPayloadJson: payload,
        isEnabled: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Runbook created." : data.error ?? "Create failed.");
    if (res.ok) {
      setName("");
      setDescription("");
      setPayload("{\"agentId\":\"integrity\"}");
      setCron("");
    }
    await load();
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Runbooks</h1>
      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}

      <form onSubmit={createRunbook} className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Create Runbook</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="description" className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200" />
        <div className="grid gap-2 md:grid-cols-4">
          <select value={ownerAgentId} onChange={(e) => setOwnerAgentId(e.target.value)} className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
            <option value="">Owner (optional)</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
            <option value="RUN_AGENT">RUN_AGENT</option>
            <option value="RUN_KICKOFF">RUN_KICKOFF</option>
            <option value="RUN_COMBINE">RUN_COMBINE</option>
            <option value="GENERATE_REPORT">GENERATE_REPORT</option>
          </select>
          <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
            <option value="MANUAL">MANUAL</option>
            <option value="SCHEDULED">SCHEDULED</option>
          </select>
          <input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="cron (optional)" className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200" />
        </div>
        <textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={3} className="w-full rounded bg-slate-900 px-2 py-1 text-xs text-slate-200" />
        <button disabled={busy === "create"} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-blue-100 disabled:opacity-50">
          {busy === "create" ? "Creating..." : "Create"}
        </button>
      </form>

      {runbooks.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6 text-slate-400">No runbooks yet.</div>
      ) : (
        <div className="space-y-3">
          {runbooks.map((runbook) => (
            <div key={runbook.id} className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-100">{runbook.name}</h2>
                <span className="rounded bg-slate-900 px-2 py-0.5 text-xs text-slate-300">
                  {runbook.isEnabled ? "ENABLED" : "DISABLED"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-300">{runbook.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                {runbook.actionType} · {runbook.triggerType} {runbook.cron ? `· ${runbook.cron}` : ""}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => runNow(runbook.id)}
                  disabled={busy === runbook.id || !runbook.isEnabled}
                  className="rounded bg-green-700 px-2 py-1 text-xs text-green-100 disabled:opacity-50"
                >
                  Run Now
                </button>
                <button
                  onClick={() => toggleEnabled(runbook.id, runbook.isEnabled)}
                  disabled={busy === runbook.id}
                  className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 disabled:opacity-50"
                >
                  {runbook.isEnabled ? "Disable" : "Enable"}
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {runbook.runs.slice(0, 3).map((r) => (
                  <p key={r.id} className="text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleString()} · {r.status} · {r.outputSummary || "No summary"}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
