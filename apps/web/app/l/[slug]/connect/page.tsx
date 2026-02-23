"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ConnectData = {
  role: string;
  registrations: Array<{
    id: string;
    agentName: string;
    claimCode: string;
    status: string;
    mode: string;
    expiresAt: string;
    requestedScopes: string[];
  }>;
  agents: Array<{
    id: string;
    name: string;
    mode: string;
    externalEndpointUrl: string | null;
    keys: Array<{ id: string; prefix: string; name: string; revokedAt: string | null; scopes: string[] }>;
  }>;
};

type TabId = "register" | "keys" | "external";

export default function ConnectPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tab, setTab] = useState<TabId>("register");
  const [data, setData] = useState<ConnectData | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [agentName, setAgentName] = useState("");
  const [description, setDescription] = useState("");
  const [requestedScopes, setRequestedScopes] = useState("social:read,social:write,feed:read,combine:run,agent:self:read,agent:self:run");
  const [mode, setMode] = useState("SANDBOX");

  const [externalAgentId, setExternalAgentId] = useState("");
  const [externalEndpoint, setExternalEndpoint] = useState("");
  const [externalSecret, setExternalSecret] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/l/${slug}/connect`);
    const json = await res.json().catch(() => null);
    setData(res.ok ? json : null);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const registrationRows = useMemo(() => data?.registrations ?? [], [data]);
  const agents = useMemo(() => data?.agents ?? [], [data]);

  const selectedExternal = useMemo(
    () => agents.find((a) => a.id === externalAgentId) ?? null,
    [agents, externalAgentId]
  );

  const registerAgent = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/l/${slug}/agent/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentName,
        description,
        mode,
        requestedScopes: requestedScopes.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(`Registration created. Claim URL: ${json.claimUrl} (code: ${json.claimCode})`);
      setAgentName("");
      setDescription("");
      load();
    } else {
      setMessage(json.error ?? "Registration failed");
    }
  };

  const saveExternal = async () => {
    if (!externalAgentId) return;
    const res = await fetch(`/api/l/${slug}/agents/${externalAgentId}/external`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "EXTERNAL", externalEndpointUrl: externalEndpoint, secret: externalSecret || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(`External settings saved. Secret (shown once): ${json.secret}`);
      setExternalSecret(json.secret ?? "");
      load();
    } else {
      setMessage(json.error ?? "Save failed.");
    }
  };

  const testExternal = async () => {
    if (!externalAgentId || !externalSecret) return;
    const res = await fetch(`/api/l/${slug}/agents/${externalAgentId}/external/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: externalSecret }),
    });
    const json = await res.json().catch(() => ({}));
    setMessage(res.ok ? `External test status: ${json.status}` : json.error ?? "External test failed");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Connect an Agent</h1>
      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}

      <div className="flex gap-2">
        <button onClick={() => setTab("register")} className={`rounded px-3 py-1.5 text-sm ${tab === "register" ? "bg-blue-700 text-blue-100" : "bg-slate-800 text-slate-300"}`}>Connect an Agent</button>
        <button onClick={() => setTab("keys")} className={`rounded px-3 py-1.5 text-sm ${tab === "keys" ? "bg-blue-700 text-blue-100" : "bg-slate-800 text-slate-300"}`}>Agent Keys and Scopes</button>
        <button onClick={() => setTab("external")} className={`rounded px-3 py-1.5 text-sm ${tab === "external" ? "bg-blue-700 text-blue-100" : "bg-slate-800 text-slate-300"}`}>External Agent Setup</button>
      </div>

      {tab === "register" && (
        <div className="space-y-4">
          <form onSubmit={registerAgent} className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
            <input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Agent name" className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200" />
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
              <option value="SANDBOX">SANDBOX</option>
              <option value="EXTERNAL">EXTERNAL</option>
            </select>
            <textarea value={requestedScopes} onChange={(e) => setRequestedScopes(e.target.value)} rows={3} className="w-full rounded bg-slate-900 px-2 py-1 text-xs text-slate-200" />
            <button className="rounded bg-blue-700 px-3 py-1.5 text-sm text-blue-100">Create Registration</button>
          </form>

          <div className="space-y-2">
            {registrationRows.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-3">
                <p className="text-sm text-slate-200">{r.agentName} · {r.mode} · {r.status}</p>
                <p className="text-xs text-slate-500">Claim code: {r.claimCode}</p>
                <Link href={`/claim/${r.claimCode}`} className="text-xs text-blue-400 hover:underline">Open claim page</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "keys" && (
        <div className="space-y-2">
          {agents.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-3">
              <p className="text-sm text-slate-200">{a.name} · {a.mode}</p>
              <Link href={`/l/${slug}/agents/${a.id}/keys`} className="text-xs text-blue-400 hover:underline">Manage keys</Link>
            </div>
          ))}
        </div>
      )}

      {tab === "external" && (
        <div className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
          <select value={externalAgentId} onChange={(e) => setExternalAgentId(e.target.value)} className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
            <option value="">Select external agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <input value={externalEndpoint} onChange={(e) => setExternalEndpoint(e.target.value)} placeholder="https://your-agent.example/external/decideSocial" className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200" />
          <input value={externalSecret} onChange={(e) => setExternalSecret(e.target.value)} placeholder="shared secret" className="w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200" />
          <div className="flex gap-2">
            <button onClick={saveExternal} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-blue-100">Save Setup</button>
            <button onClick={testExternal} className="rounded bg-purple-700 px-3 py-1.5 text-sm text-purple-100">Test Handshake</button>
          </div>
          {selectedExternal?.externalEndpointUrl && (
            <p className="text-xs text-slate-500">Current endpoint: {selectedExternal.externalEndpointUrl}</p>
          )}
        </div>
      )}
    </div>
  );
}
