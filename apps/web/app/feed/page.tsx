"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

interface FeedEvent {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
  tier: number | null;
  entityType: string | null;
  entityId: string | null;
  taskId: string | null;
  approvalId: string | null;
  proposalId: string | null;
  incidentId: string | null;
  postId: string | null;
  combineRunId: string | null;
  runbookId: string | null;
  runbookRunId: string | null;
  seasonPhaseId: string | null;
  agentId: string | null;
  agent: { id: string; name: string } | null;
}

const TYPE_COLORS: Record<string, string> = {
  AGENT_RUN: "bg-blue-500/20 text-blue-300",
  AGENT_RUN_START: "bg-indigo-500/20 text-indigo-300",
  AGENT_RUN_FAILED: "bg-red-500/20 text-red-300",
  AGENT_WEEKLY_REPORT: "bg-cyan-500/20 text-cyan-300",
  TASK_CREATED: "bg-green-500/20 text-green-300",
  TASK_UPDATED: "bg-cyan-500/20 text-cyan-300",
  APPROVAL_CREATED: "bg-yellow-500/20 text-yellow-300",
  APPROVED: "bg-green-600/20 text-green-200",
  REJECTED: "bg-red-500/20 text-red-300",
  DEFERRED: "bg-amber-500/20 text-amber-200",
  INCIDENT_CREATED: "bg-red-700/20 text-red-200",
  INCIDENT_RESOLVED: "bg-green-700/20 text-green-200",
  SEASON_LOCK: "bg-red-600/20 text-red-200",
  KICKOFF: "bg-purple-500/20 text-purple-300",
  SOCIAL_POST_CREATED: "bg-pink-500/20 text-pink-300",
  SOCIAL_COMMENT_CREATED: "bg-pink-700/20 text-pink-200",
  SOCIAL_REACTION: "bg-rose-500/20 text-rose-300",
  SOCIAL_MODERATION_ACTION: "bg-rose-700/20 text-rose-200",
  COMBINE_RUN_CREATED: "bg-violet-500/20 text-violet-300",
  COMBINE_RUN_STARTED: "bg-violet-600/20 text-violet-200",
  COMBINE_RUN_COMPLETED: "bg-violet-700/20 text-violet-100",
  COMBINE_RUN_FAILED: "bg-red-800/20 text-red-200",
  SEASON_PHASE_CREATED: "bg-amber-500/20 text-amber-300",
  SEASON_PHASE_ACTIVATED: "bg-amber-700/20 text-amber-200",
  RUNBOOK_CREATED: "bg-cyan-500/20 text-cyan-300",
  RUNBOOK_UPDATED: "bg-cyan-600/20 text-cyan-200",
  RUNBOOK_RUN_STARTED: "bg-cyan-700/20 text-cyan-200",
  RUNBOOK_RUN_COMPLETED: "bg-cyan-800/20 text-cyan-100",
  RUNBOOK_RUN_FAILED: "bg-red-900/20 text-red-100",
  SEED: "bg-slate-500/20 text-slate-300",
};

function eventHref(ev: FeedEvent): string | null {
  if (ev.entityType === "TASK" && ev.entityId) return `/tasks/${ev.entityId}`;
  if (ev.entityType === "APPROVAL" && ev.entityId) return `/approvals/${ev.entityId}`;
  if (ev.entityType === "PROPOSAL" && ev.approvalId) return `/approvals/${ev.approvalId}`;
  if (ev.entityType === "PROPOSAL" && ev.entityId) return "/approvals";
  if (ev.entityType === "INCIDENT" && ev.entityId) return `/incidents/${ev.entityId}`;
  if (ev.entityType === "AGENT" && ev.entityId) return `/agents/${ev.entityId}`;
  if (ev.entityType === "POST" && ev.entityId) return `/social/${ev.entityId}`;
  if (ev.entityType === "COMBINE_RUN" && ev.entityId) return `/combine/${ev.entityId}`;
  if (ev.entityType === "RUNBOOK" && ev.entityId) return "/runbooks";
  if (ev.entityType === "SEASON_PHASE" && ev.entityId) return "/season";
  if (ev.taskId) return `/tasks/${ev.taskId}`;
  if (ev.approvalId) return `/approvals/${ev.approvalId}`;
  if (ev.incidentId) return `/incidents/${ev.incidentId}`;
  if (ev.postId) return `/social/${ev.postId}`;
  if (ev.combineRunId) return `/combine/${ev.combineRunId}`;
  if (ev.runbookId || ev.runbookRunId) return "/runbooks";
  if (ev.seasonPhaseId) return "/season";
  if (ev.agentId) return `/agents/${ev.agentId}`;
  return null;
}

export default function FeedPage() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [filterAgent, setFilterAgent] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterTier, setFilterTier] = useState("");
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
          setEvents((prev) => [ev, ...prev].slice(0, 300));
        }
      } catch {
        // ignore malformed chunk
      }
    };

    return () => es.close();
  }, []);

  const filtered = useMemo(
    () =>
      events.filter((ev) => {
        if (filterAgent && ev.agentId !== filterAgent) return false;
        if (filterType && ev.type !== filterType) return false;
        if (filterTier && String(ev.tier ?? "") !== filterTier) return false;
        return true;
      }),
    [events, filterAgent, filterType, filterTier]
  );

  const agentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const ev of events) if (ev.agent) map.set(ev.agent.id, ev.agent.name);
    return Array.from(map.entries());
  }, [events]);

  const typeOptions = useMemo(() => Array.from(new Set(events.map((ev) => ev.type))).sort(), [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Activity Feed</h1>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
          <span className="text-xs text-slate-400">{connected ? "Live" : "Connecting..."}</span>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-700/50 bg-slate-800/60 p-3 md:grid-cols-3">
        <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
          <option value="">All agents</option>
          {agentOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
          <option value="">All event types</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
          <option value="">All tiers</option>
          <option value="0">Tier 0</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6 text-slate-400">No matching events.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ev) => {
            const typeColor = TYPE_COLORS[ev.type] ?? "bg-slate-500/20 text-slate-300";
            const href = eventHref(ev);
            const body = (
              <>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${typeColor}`}>{ev.type.replace(/_/g, " ")}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 leading-snug">{ev.summary}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ev.agent?.name ?? "System"}
                    {ev.tier !== null ? ` - Tier ${ev.tier}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-500">{new Date(ev.createdAt).toLocaleTimeString()}</span>
              </>
            );
            if (!href) {
              return (
                <div key={ev.id} className="flex items-start gap-3 rounded-xl border border-slate-700/40 bg-slate-800/50 p-3">
                  {body}
                </div>
              );
            }
            return (
              <Link key={ev.id} href={href} className="flex items-start gap-3 rounded-xl border border-slate-700/40 bg-slate-800/50 p-3 hover:bg-slate-800/70">
                {body}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
