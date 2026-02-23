"use client";

import { useEffect, useRef, useState } from "react";

interface FeedEvent {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
  agent: { id: string; name: string } | null;
}

const TYPE_COLORS: Record<string, string> = {
  AGENT_RUN: "bg-blue-500/20 text-blue-300",
  TASK_CREATED: "bg-green-500/20 text-green-300",
  TASK_UPDATED: "bg-cyan-500/20 text-cyan-300",
  APPROVAL_CREATED: "bg-yellow-500/20 text-yellow-300",
  APPROVED: "bg-green-600/20 text-green-200",
  REJECTED: "bg-red-500/20 text-red-300",
  SEASON_LOCK: "bg-red-600/20 text-red-200",
  KICKOFF: "bg-purple-500/20 text-purple-300",
  SEED: "bg-slate-500/20 text-slate-300",
};

export default function FeedPage() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource("/api/feed/stream");

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const ev: FeedEvent = JSON.parse(e.data);
        if (!seenIds.current.has(ev.id)) {
          seenIds.current.add(ev.id);
          setEvents((prev) => [ev, ...prev].slice(0, 200));
        }
      } catch {}
    };

    return () => es.close();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Activity Feed</h1>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
          <span className="text-xs text-slate-400">{connected ? "Live" : "Connecting…"}</span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6 text-slate-400">
          No events yet. Run Season 0 Kickoff to populate.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => {
            const typeColor = TYPE_COLORS[ev.type] ?? "bg-slate-500/20 text-slate-300";
            return (
              <div
                key={ev.id}
                className="flex items-start gap-3 rounded-xl border border-slate-700/40 bg-slate-800/50 p-3"
              >
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${typeColor}`}>
                  {ev.type.replace(/_/g, " ")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 leading-snug">{ev.summary}</p>
                  {ev.agent && (
                    <p className="text-xs text-slate-500 mt-0.5">{ev.agent.name}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-500">
                  {new Date(ev.createdAt).toLocaleTimeString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
