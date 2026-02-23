"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type AgentKey = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  scopes: string[];
};

export default function AgentKeysPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [keys, setKeys] = useState<AgentKey[]>([]);
  const [name, setName] = useState("rotated key");
  const [scopes, setScopes] = useState("social:read,social:write,feed:read,agent:self:read,agent:self:run");
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/l/${slug}/agents/${id}/keys`);
    const data = await res.json().catch(() => []);
    setKeys(Array.isArray(data) ? data : []);
  }, [slug, id]);

  useEffect(() => {
    load();
  }, [load]);

  const createKey = async () => {
    const res = await fetch(`/api/l/${slug}/agents/${id}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        scopes: scopes.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setShownKey(data.key ?? null);
      setMessage("Key created. Copy it now.");
      load();
    } else {
      setMessage(data.error ?? "Create key failed.");
    }
  };

  const revokeKey = async (keyId: string) => {
    const res = await fetch(`/api/l/${slug}/agents/${id}/keys/${keyId}/revoke`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Key revoked." : data.error ?? "Revoke failed.");
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Agent Keys and Scopes</h1>
      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}
      {shownKey && (
        <div className="rounded border border-amber-700/40 bg-amber-900/20 p-3 text-sm text-amber-200">
          API key (shown once): <code>{shownKey}</code>
        </div>
      )}

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Create Key</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded bg-slate-900 px-2 py-1 text-sm text-slate-200" />
        <textarea value={scopes} onChange={(e) => setScopes(e.target.value)} rows={3} className="mt-2 w-full rounded bg-slate-900 px-2 py-1 text-xs text-slate-200" />
        <button onClick={createKey} className="mt-2 rounded bg-blue-700 px-3 py-1.5 text-sm text-blue-100">Create Key</button>
      </div>

      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-3">
            <p className="text-sm text-slate-200">{k.name} ({k.prefix}...)</p>
            <p className="text-xs text-slate-500">Last used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}</p>
            <p className="text-xs text-slate-500">Status: {k.revokedAt ? "revoked" : "active"}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {k.scopes.map((s) => (
                <span key={s} className="rounded bg-slate-900 px-2 py-0.5 text-xs text-slate-300">{s}</span>
              ))}
            </div>
            {!k.revokedAt && (
              <button onClick={() => revokeKey(k.id)} className="mt-2 rounded bg-red-700 px-2 py-1 text-xs text-red-100">Revoke</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
