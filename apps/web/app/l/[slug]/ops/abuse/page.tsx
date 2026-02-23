"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type AbuseEvent = {
  id: string;
  type: string;
  detail: string;
  createdAt: string;
  agent: { id: string; name: string } | null;
  apiKey: { id: string; name: string; prefix: string; revokedAt: string | null } | null;
};

export default function AbuseOpsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [events, setEvents] = useState<AbuseEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/l/${slug}/ops/abuse`);
    const data = await res.json().catch(() => []);
    setEvents(Array.isArray(data) ? data : []);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const revokeKey = async (apiKeyId: string) => {
    const res = await fetch(`/api/l/${slug}/ops/abuse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKeyId }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "API key revoked." : data.error ?? "Failed to revoke.");
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-100">Abuse Events</h1>
      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}
      <div className="space-y-2">
        {events.length === 0 && <p className="rounded-xl bg-slate-800/60 p-4 text-sm text-slate-500">No abuse events logged.</p>}
        {events.map((ev) => (
          <div key={ev.id} className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-3">
            <p className="text-sm text-slate-200">{ev.type}</p>
            <p className="text-xs text-slate-400">{ev.detail}</p>
            <p className="mt-1 text-xs text-slate-500">
              Agent: {ev.agent?.name ?? "n/a"} | Key: {ev.apiKey ? `${ev.apiKey.name} (${ev.apiKey.prefix}...)` : "n/a"} | {new Date(ev.createdAt).toLocaleString()}
            </p>
            {ev.apiKey && !ev.apiKey.revokedAt && (
              <button
                onClick={() => revokeKey(ev.apiKey!.id)}
                className="mt-2 rounded bg-red-700 px-2 py-1 text-xs text-red-100"
              >
                Revoke Key
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
