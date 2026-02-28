"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AispnField } from "@/components/aispn-field";

type Team = { id: string; shortName: string; name: string };

type Game = {
  id: string;
  week: number;
  kickoffAt: string | null;
  status: "SCHEDULED" | "LIVE" | "FINAL";
  startedAt: string | null;
  finishedAt: string | null;
  scoreHome: number;
  scoreAway: number;
  homeTeam: Team;
  awayTeam: Team;
  winnerTeamId: string | null;
};

type Drive = {
  id: string;
  driveNumber: number;
  startQtr: number;
  startTimeSeconds: number;
  startYardLine: number;
  endReason: string | null;
  points: number;
  offenseTeam: Team;
  defenseTeam: Team;
};

type Play = {
  id: string;
  playNumber: number;
  qtr: number;
  timeSeconds: number;
  down: number;
  distance: number;
  yardLine: number;
  description: string;
  resultJson: string;
  offenseTeam: Team;
  defenseTeam: Team;
};

type BoxScore = {
  totals: {
    passYards: number;
    rushYards: number;
    turnovers: number;
    thirdDownAttempts: number;
    thirdDownConversions: number;
    timeOfPossessionSeconds: number;
    plays: number;
  };
};

type GamePayload = {
  game: Game;
  drives: Drive[];
  plays: Play[];
  boxScore: BoxScore;
};

type GameState = {
  qtr: number;
  timeSeconds: number;
  down: number;
  distance: number;
  yardLine: number;
  offenseTeamId: string;
  defenseTeamId: string;
  driveNumber: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatKickoff(kickoffAt: string | null) {
  if (!kickoffAt) return "TBD";
  const d = new Date(kickoffAt);
  return d.toLocaleString();
}

function safeParseResult(play: Play | null): Partial<GameState> | null {
  if (!play) return null;
  try {
    const parsed = JSON.parse(play.resultJson) as Partial<GameState> & {
      td?: boolean;
      fg?: boolean;
      turnover?: boolean;
      firstDown?: boolean;
      yards?: number;
      type?: string;
    };
    return parsed ?? null;
  } catch {
    return null;
  }
}

function stateFrom(data: GamePayload | null): { state: GameState | null; latestPlay: Play | null; result: ReturnType<typeof safeParseResult> } {
  const latestPlay = data?.plays?.[0] ?? null;
  const result = safeParseResult(latestPlay);
  if (!data) return { state: null, latestPlay: null, result };

  // Game engine starts with away team offense, left-to-right toward the far endzone.
  const fallback: GameState = {
    qtr: latestPlay?.qtr ?? 1,
    timeSeconds: latestPlay?.timeSeconds ?? 15 * 60,
    down: latestPlay?.down ?? 1,
    distance: latestPlay?.distance ?? 10,
    yardLine: latestPlay?.yardLine ?? 25,
    offenseTeamId: data.game.awayTeam.id,
    defenseTeamId: data.game.homeTeam.id,
    driveNumber: 1,
  };

  if (!latestPlay || !result) return { state: fallback, latestPlay, result };

  const state: GameState = {
    qtr: clamp(result.qtr ?? latestPlay.qtr, 1, 4),
    timeSeconds: clamp(result.timeSeconds ?? latestPlay.timeSeconds, 0, 15 * 60),
    down: clamp(result.down ?? latestPlay.down, 1, 4),
    distance: clamp(result.distance ?? latestPlay.distance, 1, 99),
    yardLine: clamp(result.yardLine ?? latestPlay.yardLine, 0, 100),
    offenseTeamId: result.offenseTeamId ?? fallback.offenseTeamId,
    defenseTeamId: result.defenseTeamId ?? fallback.defenseTeamId,
    driveNumber: result.driveNumber ?? fallback.driveNumber,
  };

  return { state, latestPlay, result };
}

export function AispnGamecast({ slug, gameId }: { slug: string; gameId: string }) {
  const [data, setData] = useState<GamePayload | null>(null);
  const [tab, setTab] = useState<"gamecast" | "plays" | "drives" | "box">("gamecast");
  const [connected, setConnected] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/p/${slug}/games/${gameId}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setData(res.ok ? (json as GamePayload) : null);
  }, [gameId, slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const es = new EventSource(`/api/p/${slug}/games/${gameId}/stream`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = () => load();
    return () => es.close();
  }, [gameId, load, slug]);

  const derived = useMemo(() => stateFrom(data), [data]);
  const state = derived.state;
  const latestPlay = derived.latestPlay;
  const result = derived.result as any;

  const offenseTeam = useMemo(() => {
    if (!data || !state) return null;
    if (state.offenseTeamId === data.game.homeTeam.id) return data.game.homeTeam;
    if (state.offenseTeamId === data.game.awayTeam.id) return data.game.awayTeam;
    return data.game.awayTeam;
  }, [data, state]);

  const defenseTeam = useMemo(() => {
    if (!data || !state) return null;
    if (state.defenseTeamId === data.game.homeTeam.id) return data.game.homeTeam;
    if (state.defenseTeamId === data.game.awayTeam.id) return data.game.awayTeam;
    return data.game.homeTeam;
  }, [data, state]);

  const scoringPlays = useMemo(() => {
    if (!data) return [];
    const playsAsc = [...data.plays].reverse();
    const scored = [];
    for (const p of playsAsc) {
      const r = safeParseResult(p) as any;
      if (r?.td || r?.fg) scored.push({ play: p, result: r });
    }
    return scored.slice(-12);
  }, [data]);

  if (!data || !state || !offenseTeam || !defenseTeam) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 text-slate-100">
        <p className="text-slate-400">Loading AISPN GameCast...</p>
      </div>
    );
  }

  const awayWins = data.game.winnerTeamId === data.game.awayTeam.id ? " text-emerald-200" : "";
  const homeWins = data.game.winnerTeamId === data.game.homeTeam.id ? " text-emerald-200" : "";
  const statusPill =
    data.game.status === "LIVE"
      ? "bg-rose-600/20 text-rose-200 ring-rose-500/30"
      : data.game.status === "FINAL"
        ? "bg-emerald-700/20 text-emerald-200 ring-emerald-500/30"
        : "bg-slate-600/20 text-slate-200 ring-slate-500/30";

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-6 py-8 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">AISPN Game Center</p>
          <p className="mt-1 text-sm text-slate-300">
            <span className="text-slate-200">Week {data.game.week}</span>
            <span className="text-slate-500"> | </span>
            <span className="text-slate-300">{formatKickoff(data.game.kickoffAt)}</span>
          </p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusPill}`}>
          {data.game.status}
          <span className="ml-2 text-[10px] opacity-80">{connected ? "LIVE FEED" : "POLLING"}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-[0_10px_40px_rgba(2,8,23,0.55)]">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
          <div className="space-y-1">
            <p className={`text-sm font-semibold text-slate-200 ${awayWins}`}>{data.game.awayTeam.name}</p>
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-black tracking-tight">{data.game.awayTeam.shortName}</p>
              <p className="text-5xl font-black tabular-nums">{data.game.scoreAway}</p>
            </div>
          </div>
          <div className="hidden text-center text-xs uppercase tracking-[0.25em] text-slate-400 md:block">
            AISPN
            <div className="mt-1 text-[10px] normal-case tracking-normal text-slate-500">GameCast</div>
          </div>
          <div className="space-y-1 text-right">
            <p className={`text-sm font-semibold text-slate-200 ${homeWins}`}>{data.game.homeTeam.name}</p>
            <div className="flex items-baseline justify-between gap-3 md:justify-end">
              <p className="text-5xl font-black tabular-nums">{data.game.scoreHome}</p>
              <p className="text-3xl font-black tracking-tight">{data.game.homeTeam.shortName}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <p>
            <span className="font-semibold text-slate-200">Q{state.qtr}</span>{" "}
            <span className="tabular-nums text-slate-300">{clock(state.timeSeconds)}</span>
            <span className="text-slate-600"> | </span>
            <span className="text-slate-300">{offenseTeam.shortName} ball</span>
            <span className="text-slate-600"> | </span>
            <span className="text-slate-300">Drive {state.driveNumber}</span>
          </p>
          <Link href={`/p/${slug}/games`} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-slate-200 hover:bg-white/10">
            Back to Games
          </Link>
        </div>
      </div>

      <AispnField
        offenseLabel={offenseTeam.shortName}
        defenseLabel={defenseTeam.shortName}
        down={state.down}
        distance={state.distance}
        yardLine={state.yardLine}
        qtr={state.qtr}
        timeSeconds={state.timeSeconds}
        lastPlay={latestPlay?.description ?? null}
      />

      <div className="flex flex-wrap gap-2">
        {(["gamecast", "plays", "drives", "box"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ring-1 transition ${
              tab === key
                ? "bg-cyan-400/15 text-cyan-100 ring-cyan-300/35"
                : "bg-slate-900/40 text-slate-200 ring-white/10 hover:bg-slate-900/60"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {tab === "gamecast" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Key Drives</p>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              {data.drives.slice(-6).map((d) => (
                <div key={d.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-100">
                      Drive {d.driveNumber}: {d.offenseTeam.shortName}
                    </p>
                    <span className="text-xs text-slate-400">{d.endReason ? `${d.endReason} (${d.points})` : "IN PROGRESS"}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Start: Q{d.startQtr} {clock(d.startTimeSeconds)} | YardLine {d.startYardLine}
                  </p>
                </div>
              ))}
              {data.drives.length === 0 && <p className="text-slate-400">No drives yet.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Scoring Summary</p>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              {scoringPlays.length === 0 ? (
                <p className="text-slate-400">No scoring plays yet.</p>
              ) : (
                scoringPlays.map((s) => (
                  <div key={s.play.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-100">
                        Q{s.play.qtr} {clock(s.play.timeSeconds)}
                      </p>
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${s.result?.td ? "bg-emerald-700/30 text-emerald-200" : "bg-amber-700/30 text-amber-200"}`}>
                        {s.result?.td ? "TD" : "FG"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{s.play.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "plays" && (
        <div className="space-y-2">
          {data.plays.map((p) => {
            const r = safeParseResult(p) as any;
            const badges: Array<{ label: string; cls: string }> = [];
            if (r?.td) badges.push({ label: "TD", cls: "bg-emerald-700/30 text-emerald-200 ring-emerald-500/30" });
            if (r?.fg) badges.push({ label: "FG", cls: "bg-amber-700/30 text-amber-200 ring-amber-500/30" });
            if (r?.turnover) badges.push({ label: "TO", cls: "bg-rose-700/30 text-rose-200 ring-rose-500/30" });
            if (r?.firstDown) badges.push({ label: "1D", cls: "bg-cyan-700/30 text-cyan-200 ring-cyan-500/30" });

            return (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Play {p.playNumber} | Q{p.qtr} {clock(p.timeSeconds)}
                  </p>
                  <div className="flex gap-1.5">
                    {badges.map((b) => (
                      <span key={b.label} className={`rounded px-2 py-0.5 text-[10px] font-bold ring-1 ${b.cls}`}>
                        {b.label}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-100">{p.description}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {p.offenseTeam.shortName} {p.down}&{p.distance} | YardLine {p.yardLine}
                </p>
              </div>
            );
          })}
          {data.plays.length === 0 && <p className="rounded-xl bg-slate-950/55 p-4 text-sm text-slate-400">No plays yet.</p>}
        </div>
      )}

      {tab === "drives" && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Drive Log</p>
          <div className="mt-3 space-y-2">
            {data.drives.map((d) => (
              <div key={d.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-100">
                    Drive {d.driveNumber}: {d.offenseTeam.shortName} vs {d.defenseTeam.shortName}
                  </p>
                  <span className="text-xs text-slate-400">{d.endReason ? `${d.endReason} (${d.points})` : "IN PROGRESS"}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Start: Q{d.startQtr} {clock(d.startTimeSeconds)} | YardLine {d.startYardLine}
                </p>
              </div>
            ))}
            {data.drives.length === 0 && <p className="text-sm text-slate-400">No drives yet.</p>}
          </div>
        </div>
      )}

      {tab === "box" && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Box Score (Totals)</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p className="rounded-lg border border-white/10 bg-slate-950/50 p-3">Plays: {data.boxScore.totals.plays}</p>
            <p className="rounded-lg border border-white/10 bg-slate-950/50 p-3">Pass Yards: {data.boxScore.totals.passYards}</p>
            <p className="rounded-lg border border-white/10 bg-slate-950/50 p-3">Rush Yards: {data.boxScore.totals.rushYards}</p>
            <p className="rounded-lg border border-white/10 bg-slate-950/50 p-3">Turnovers: {data.boxScore.totals.turnovers}</p>
            <p className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
              3rd Down: {data.boxScore.totals.thirdDownConversions}/{data.boxScore.totals.thirdDownAttempts}
            </p>
            <p className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
              TOP: {Math.floor(data.boxScore.totals.timeOfPossessionSeconds / 60)}:{String(data.boxScore.totals.timeOfPossessionSeconds % 60).padStart(2, "0")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

