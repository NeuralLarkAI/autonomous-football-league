"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AispnField } from "@/components/aispn-field";
import { AgentAvatar } from "@/components/agent-avatar";

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

type ChatPost = {
  id: string;
  title: string;
  bodyMarkdown: string;
  tagsParsed: string[];
  createdAt: string;
  authorAgent: { id: string; name: string; department: string } | null;
  commentCount: number;
  upvoteCount: number;
  starCount: number;
};

type GamePayload = {
  game: Game;
  drives: Drive[];
  plays: Play[];
  boxScore: BoxScore;
  chatPosts: ChatPost[];
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

type PlayResult = Partial<GameState> & {
  td?: boolean;
  fg?: boolean;
  turnover?: boolean;
  firstDown?: boolean;
  yards?: number;
  type?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
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

function safeParseResult(play: Play | null): PlayResult | null {
  if (!play) return null;
  try {
    const parsed = JSON.parse(play.resultJson) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as PlayResult;
  } catch {
    return null;
  }
}

function stateFrom(data: GamePayload | null): { state: GameState | null; latestPlay: Play | null; result: PlayResult | null } {
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
  const [tab, setTab] = useState<"gamecast" | "plays" | "drives" | "box" | "chat">("gamecast");
  const [connected, setConnected] = useState(false);
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null);
  const [pulseAway, setPulseAway] = useState(false);
  const [pulseHome, setPulseHome] = useState(false);
  const [scoringFlash, setScoringFlash] = useState<string | null>(null);
  const prevScoreAway = useRef<number>(0);
  const prevScoreHome = useRef<number>(0);
  const lastFlashPlayId = useRef<string | null>(null);

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
  const latestPlay = derived.latestPlay;

  const playsDesc = data?.plays ?? [];
  const selectedPlay = selectedPlayId ? playsDesc.find((p) => p.id === selectedPlayId) ?? null : null;

  // For "live" field view we use the engine's post-play state (from resultJson).
  // For replay selection we show the pre-play situation (from the play row itself).
  const state = useMemo(() => {
    if (!data) return null;
    if (!selectedPlay) return derived.state;
    const r = safeParseResult(selectedPlay);
    return {
      qtr: clamp(selectedPlay.qtr, 1, 4),
      timeSeconds: clamp(selectedPlay.timeSeconds, 0, 15 * 60),
      down: clamp(selectedPlay.down, 1, 4),
      distance: clamp(selectedPlay.distance, 1, 99),
      yardLine: clamp(selectedPlay.yardLine, 0, 100),
      offenseTeamId: selectedPlay.offenseTeam.id,
      defenseTeamId: selectedPlay.defenseTeam.id,
      driveNumber: clamp(toNumber(r?.driveNumber) ?? derived.state?.driveNumber ?? 1, 1, 999),
    } satisfies GameState;
  }, [data, derived.state, selectedPlay]);

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
    const scored: Array<{ play: Play; result: PlayResult }> = [];
    for (const p of playsAsc) {
      const r = safeParseResult(p);
      if (r?.td || r?.fg) scored.push({ play: p, result: r });
    }
    return scored.slice(-12);
  }, [data]);

  useEffect(() => {
    if (!data) return;

    if (data.game.scoreAway > prevScoreAway.current) {
      setPulseAway(true);
      setTimeout(() => setPulseAway(false), 700);
    }
    if (data.game.scoreHome > prevScoreHome.current) {
      setPulseHome(true);
      setTimeout(() => setPulseHome(false), 700);
    }
    prevScoreAway.current = data.game.scoreAway;
    prevScoreHome.current = data.game.scoreHome;

    const latest = data.plays?.[0] ?? null;
    if (latest && latest.id !== lastFlashPlayId.current) {
      const r = safeParseResult(latest);
      if (r?.td) {
        lastFlashPlayId.current = latest.id;
        setScoringFlash("TOUCHDOWN!");
        setTimeout(() => setScoringFlash(null), 2200);
      } else if (r?.fg) {
        lastFlashPlayId.current = latest.id;
        setScoringFlash("FIELD GOAL!");
        setTimeout(() => setScoringFlash(null), 2200);
      }
    }
  }, [data]);

  const playMeta = (p: Play) => {
    const r = safeParseResult(p);
    const desc = (p.description || "").toLowerCase();
    const yards = toNumber(r?.yards);

    const icon = (() => {
      if (r?.td) return "🏈";
      if (r?.fg) return "🎯";
      if (r?.turnover) return "⚠️";
      if (desc.includes("penalty")) return "🚩";
      if (desc.includes("punt")) return "👟";
      if (desc.includes("pass") && yards != null && yards > 0) return "✅";
      if (desc.includes("pass")) return "❌";
      if (r?.firstDown) return "🔑";
      if (desc.includes("run") || desc.includes("rush")) return "🏃";
      return "🏈";
    })();

    const rowTone = (() => {
      if (r?.td) return "bg-yellow-900/30 border-yellow-500/30";
      if (r?.fg) return "bg-emerald-900/20 border-emerald-500/20";
      if (yards != null && yards < 0) return "bg-red-900/20 border-white/10";
      if (yards != null && yards >= 10) return "bg-green-900/20 border-white/10";
      if (yards != null && yards >= 0 && yards <= 3) return "bg-slate-800/40 border-white/10";
      return "bg-slate-950/55 border-white/10";
    })();

    const iconTone = (() => {
      if (r?.td) return "text-yellow-300";
      if (r?.fg) return "text-emerald-200";
      if (r?.turnover) return "text-rose-300";
      if (desc.includes("penalty")) return "text-red-300";
      if (desc.includes("punt")) return "text-slate-300";
      if (desc.includes("pass") && yards != null && yards > 0) return "text-blue-200";
      if (desc.includes("pass")) return "text-slate-300";
      if (desc.includes("run") || desc.includes("rush")) return "text-emerald-200";
      return "text-slate-200";
    })();

    return { r, icon, rowTone, iconTone, yards };
  };

  if (!data || !state || !offenseTeam || !defenseTeam) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 text-slate-100">
        <p className="text-slate-400">Loading AISPN GameCast...</p>
      </div>
    );
  }

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

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
        <div className="relative">
          {scoringFlash && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center animate-td-flash">
              <span className="text-4xl font-black tracking-widest text-yellow-300 drop-shadow-[0_0_20px_rgba(253,224,71,0.9)] md:text-5xl">
                {scoringFlash}
              </span>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
          <div className="space-y-1">
            <p className={`text-sm font-semibold text-slate-200 ${awayWins}`}>{data.game.awayTeam.name}</p>
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-black tracking-tight">{data.game.awayTeam.shortName}</p>
              <p className={`text-5xl font-black tabular-nums ${pulseAway ? "animate-score-pulse" : ""}`}>{data.game.scoreAway}</p>
            </div>
          </div>
          <div className="hidden text-center text-xs uppercase tracking-[0.25em] text-slate-400 md:block">
            AISPN
            <div className="mt-1 text-[10px] normal-case tracking-normal text-slate-500">GameCast</div>
          </div>
          <div className="space-y-1 text-right">
            <p className={`text-sm font-semibold text-slate-200 ${homeWins}`}>{data.game.homeTeam.name}</p>
            <div className="flex items-baseline justify-between gap-3 md:justify-end">
              <p className={`text-5xl font-black tabular-nums ${pulseHome ? "animate-score-pulse" : ""}`}>{data.game.scoreHome}</p>
              <p className="text-3xl font-black tracking-tight">{data.game.homeTeam.shortName}</p>
            </div>
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
        lastPlay={(selectedPlay ?? latestPlay)?.description ?? null}
      />

      {selectedPlay && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-200">
          <p>
            <span className="text-xs uppercase tracking-[0.22em] text-slate-400">Replay</span>
            <span className="ml-2 font-semibold text-slate-100">Play {selectedPlay.playNumber}</span>
            <span className="text-slate-500"> | </span>
            <span className="text-slate-300">
              Q{selectedPlay.qtr} {clock(selectedPlay.timeSeconds)} {selectedPlay.down}&{selectedPlay.distance}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const idx = playsDesc.findIndex((p) => p.id === selectedPlay.id);
                const newer = idx > 0 ? playsDesc[idx - 1] : null;
                if (newer) setSelectedPlayId(newer.id);
              }}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
            >
              Newer
            </button>
            <button
              onClick={() => {
                const idx = playsDesc.findIndex((p) => p.id === selectedPlay.id);
                const older = idx >= 0 && idx < playsDesc.length - 1 ? playsDesc[idx + 1] : null;
                if (older) setSelectedPlayId(older.id);
              }}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
            >
              Older
            </button>
            <button
              onClick={() => setSelectedPlayId(null)}
              className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20"
            >
              Return to Live
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
        {(["gamecast", "plays", "drives", "box", "chat"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ring-1 transition ${
              tab === key
                ? "bg-cyan-400/15 text-cyan-100 ring-cyan-300/35"
                : "bg-slate-900/40 text-slate-200 ring-white/10 hover:bg-slate-900/60"
            }`}
          >
            {key === "gamecast" ? "GameCast" : key}
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
          {data.plays.map((p, idx) => {
            const meta = playMeta(p);
            const r = meta.r;
            const badges: Array<{ label: string; cls: string }> = [];
            if (r?.td) badges.push({ label: "TD", cls: "bg-emerald-700/30 text-emerald-200 ring-emerald-500/30" });
            if (r?.fg) badges.push({ label: "FG", cls: "bg-amber-700/30 text-amber-200 ring-amber-500/30" });
            if (r?.turnover) badges.push({ label: "TO", cls: "bg-rose-700/30 text-rose-200 ring-rose-500/30" });
            if (r?.firstDown) badges.push({ label: "1D", cls: "bg-cyan-700/30 text-cyan-200 ring-cyan-500/30" });

            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlayId(p.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${idx === 0 ? "animate-play-slide" : ""} ${meta.rowTone} ${
                  selectedPlayId === p.id
                    ? "border-cyan-300/35 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
                    : "hover:border-white/20"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/60 text-sm ring-1 ring-white/10 ${meta.iconTone}`}>
                      {meta.icon}
                    </span>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Play {p.playNumber} | Q{p.qtr} {clock(p.timeSeconds)}
                    </p>
                  </div>
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
              </button>
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

      {tab === "chat" && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Live Social</p>
            <Link
              href={`/p/${slug}/social`}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              Open Social Feed →
            </Link>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Showing PUBLIC posts tagged for week {data.game.week} or the teams. Updates with the live feed ({connected ? "LIVE" : "POLLING"}).
          </p>

          {data.chatPosts.length === 0 ? (
            <p className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-400">No chat posts yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
              {data.chatPosts.map((post) => (
                <div key={post.id} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <AgentAvatar name={post.authorAgent?.name} department={post.authorAgent?.department} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">{post.authorAgent?.name ?? "Commissioner"}</span>
                        <span className="text-xs text-slate-500">@{post.authorAgent?.department ?? "league"}</span>
                        <span className="text-xs text-slate-600">·</span>
                        <span className="text-xs text-slate-500">{relativeTime(post.createdAt)}</span>
                        <span className="ml-auto text-xs text-slate-500">
                          💬 {post.commentCount} · 👍 {post.upvoteCount} · ⭐ {post.starCount}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-100">{post.title}</p>
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-300">{post.bodyMarkdown}</p>
                      {post.tagsParsed.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {post.tagsParsed.slice(0, 8).map((t) => (
                            <span key={`${post.id}-${t}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                              #{t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
