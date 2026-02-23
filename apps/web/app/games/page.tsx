"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Game = {
  id: string;
  week: number;
  kickoffAt: string | null;
  status: "SCHEDULED" | "LIVE" | "FINAL";
  scoreHome: number;
  scoreAway: number;
  homeTeam: { id: string; name: string; shortName: string };
  awayTeam: { id: string; name: string; shortName: string };
};

export default function GamesPage() {
  const params = useParams<{ slug?: string }>();
  const slug = params?.slug ?? "afl-prime";
  const [games, setGames] = useState<Game[]>([]);
  const [week, setWeek] = useState<number | "ALL">("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runWeekSimRunbook = useCallback(
    async (targetWeek: number) => {
      const runbooksRes = await fetch("/api/runbooks");
      const runbooks = (await runbooksRes.json().catch(() => [])) as Array<{
        id: string;
        actionType: string;
        isEnabled: boolean;
      }>;
      const runbook = runbooks.find((r) => (r.actionType === "WEEK_SIMULATE" || r.actionType === "RUN_WEEK") && r.isEnabled);
      if (!runbook) throw new Error("No enabled week simulation runbook found.");

      const patchRes = await fetch(`/api/runbooks/${runbook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionPayloadJson: JSON.stringify({ weekNumber: targetWeek, mode: "RUN_TO_FINAL", stepSizePlays: 20 }),
        }),
      });
      if (!patchRes.ok) {
        const data = await patchRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update week simulation runbook.");
      }

      const runRes = await fetch(`/api/runbooks/${runbook.id}/run`, { method: "POST" });
      if (!runRes.ok) {
        const data = await runRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Week simulation runbook failed.");
      }
    },
    []
  );

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (week !== "ALL") qs.set("week", String(week));
    if (status !== "ALL") qs.set("status", status);
    const res = await fetch(`/api/l/${slug}/games?${qs.toString()}`);
    const data = await res.json().catch(() => []);
    setGames(Array.isArray(data) ? data : []);
  }, [slug, status, week]);

  useEffect(() => {
    load();
  }, [load]);

  const createSeason = async () => {
    setBusy(true);
    const res = await fetch(`/api/l/${slug}/season1/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seasonNumber: 1, teamCount: 8 }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Season 1 ready: ${data.gameCount} games.` : data.error ?? "Season create failed");
    await load();
    setBusy(false);
  };

  const simulateSelectedWeek = async () => {
    if (week === "ALL") return;
    setBusy(true);
    try {
      await runWeekSimRunbook(week);
      const weekGames = games.filter((g) => g.week === week);
      setMessage(`Week ${week} simulation triggered for ${weekGames.length} game(s).`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const weeks = useMemo(() => Array.from(new Set(games.map((g) => g.week))).sort((a, b) => a - b), [games]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-100">Game Center</h1>
        <div className="flex gap-2">
          <button onClick={createSeason} disabled={busy} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-blue-100 disabled:opacity-50">
            Create Season 1
          </button>
          <button onClick={simulateSelectedWeek} disabled={busy || week === "ALL"} className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-emerald-100 disabled:opacity-50">
            Simulate Selected Week
          </button>
        </div>
      </div>

      {message && <p className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-300">{message}</p>}

      <div className="grid gap-2 rounded-xl border border-slate-700/50 bg-slate-800/60 p-3 md:grid-cols-2">
        <select
          value={week}
          onChange={(e) => setWeek(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
          className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200"
        >
          <option value="ALL">All weeks</option>
          {weeks.map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded bg-slate-900 px-2 py-1 text-sm text-slate-200">
          <option value="ALL">All status</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="LIVE">Live</option>
          <option value="FINAL">Final</option>
        </select>
      </div>

      <div className="space-y-2">
        {games.length === 0 && <p className="rounded-xl bg-slate-800/60 p-4 text-sm text-slate-500">No games yet. Create Season 1.</p>}
        {games.map((g) => (
          <Link key={g.id} href={`/l/${slug}/games/${g.id}`} className="block rounded-xl border border-slate-700/50 bg-slate-800/60 p-4 hover:bg-slate-800/80">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-200">
                Week {g.week}: {g.awayTeam.shortName} @ {g.homeTeam.shortName}
              </p>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  g.status === "LIVE"
                    ? "bg-rose-900/50 text-rose-200"
                    : g.status === "FINAL"
                      ? "bg-emerald-900/40 text-emerald-200"
                      : "bg-slate-700 text-slate-300"
                }`}
              >
                {g.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {g.kickoffAt ? new Date(g.kickoffAt).toLocaleString() : "TBD"} | Score {g.awayTeam.shortName} {g.scoreAway} - {g.homeTeam.shortName} {g.scoreHome}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
