"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Play = {
  id: string;
  playNumber: number;
  qtr: number;
  timeSeconds: number;
  down: number;
  distance: number;
  yardLine: number;
  description: string;
  offenseCallJson: string;
  defenseCallJson: string;
  resultJson: string;
};

type Drive = {
  id: string;
  driveNumber: number;
  offenseTeam: { shortName: string };
  defenseTeam: { shortName: string };
  endReason: string | null;
  points: number;
};

type GamePayload = {
  game: {
    id: string;
    week: number;
    status: "SCHEDULED" | "LIVE" | "FINAL";
    scoreHome: number;
    scoreAway: number;
    homeTeam: { shortName: string; name: string };
    awayTeam: { shortName: string; name: string };
  };
  plays: Play[];
  drives: Drive[];
  boxScore: {
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
};

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function GameDetailPage() {
  const params = useParams<{ slug?: string; id: string }>();
  const slug = params?.slug ?? "afl-prime";
  const id = params.id;
  const [data, setData] = useState<GamePayload | null>(null);
  const [tab, setTab] = useState<"plays" | "box" | "coach" | "replay">("plays");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/l/${slug}/games/${id}`);
    const json = await res.json().catch(() => null);
    setData(res.ok ? json : null);
  }, [id, slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const es = new EventSource(`/api/l/${slug}/games/${id}/stream`);
    es.onmessage = () => load();
    return () => es.close();
  }, [id, load, slug]);

  const start = async () => {
    setBusy(true);
    await fetch(`/api/l/${slug}/games/${id}/start`, { method: "POST" });
    await load();
    setBusy(false);
  };

  const step = async (plays: number) => {
    setBusy(true);
    await fetch(`/api/l/${slug}/games/${id}/step?plays=${plays}`, { method: "POST" });
    await load();
    setBusy(false);
  };

  const lastPlayState = useMemo(() => {
    const latest = data?.plays[0];
    if (!latest) return null;
    try {
      const result = JSON.parse(latest.resultJson) as { qtr?: number; timeSeconds?: number };
      return { qtr: result.qtr ?? latest.qtr, timeSeconds: result.timeSeconds ?? latest.timeSeconds };
    } catch {
      return { qtr: latest.qtr, timeSeconds: latest.timeSeconds };
    }
  }, [data?.plays]);

  if (!data) return <p className="text-slate-400">Loading game...</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">Week {data.game.week}</p>
          <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{data.game.status}</span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-xl font-bold text-slate-100">{data.game.awayTeam.shortName}</p>
            <p className="text-4xl font-bold text-slate-100">{data.game.scoreAway}</p>
          </div>
          <div className="text-center text-sm text-slate-400">
            <p>{lastPlayState ? `Q${lastPlayState.qtr} ${clock(lastPlayState.timeSeconds)}` : "Not started"}</p>
            <p>@</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-slate-100">{data.game.homeTeam.shortName}</p>
            <p className="text-4xl font-bold text-slate-100">{data.game.scoreHome}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={start} disabled={busy || data.game.status === "FINAL"} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-blue-100 disabled:opacity-50">
          Start Game
        </button>
        <button onClick={() => step(5)} disabled={busy || data.game.status === "FINAL"} className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-emerald-100 disabled:opacity-50">
          Step +5
        </button>
        <button onClick={() => step(20)} disabled={busy || data.game.status === "FINAL"} className="rounded bg-emerald-900 px-3 py-1.5 text-sm text-emerald-100 disabled:opacity-50">
          Step +20
        </button>
      </div>

      <div className="flex gap-2">
        {(["plays", "box", "coach", "replay"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded px-3 py-1.5 text-sm ${tab === key ? "bg-blue-700 text-blue-100" : "bg-slate-800 text-slate-300"}`}
          >
            {key === "plays" ? "Play-by-Play" : key === "box" ? "Box Score" : key === "coach" ? "Coach Log" : "Replay"}
          </button>
        ))}
      </div>

      {tab === "plays" && (
        <div className="space-y-2">
          {data.plays.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-700/40 bg-slate-800/60 p-3">
              <p className="text-sm text-slate-200">#{p.playNumber} Q{p.qtr} {clock(p.timeSeconds)} - {p.description}</p>
              <p className="text-xs text-slate-500">Down {p.down} & {p.distance} | Yardline {p.yardLine}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "box" && (
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/60 p-4 text-sm text-slate-300">
          <p>Plays: {data.boxScore.totals.plays}</p>
          <p>Pass Yards: {data.boxScore.totals.passYards}</p>
          <p>Rush Yards: {data.boxScore.totals.rushYards}</p>
          <p>Turnovers: {data.boxScore.totals.turnovers}</p>
          <p>3rd Down: {data.boxScore.totals.thirdDownConversions}/{data.boxScore.totals.thirdDownAttempts}</p>
        </div>
      )}

      {tab === "coach" && (
        <div className="space-y-2">
          {data.plays.map((p) => {
            const off = JSON.parse(p.offenseCallJson) as Record<string, unknown>;
            const def = JSON.parse(p.defenseCallJson) as Record<string, unknown>;
            return (
              <div key={p.id} className="rounded-xl border border-slate-700/40 bg-slate-800/60 p-3 text-xs text-slate-300">
                <p className="text-slate-200">Play #{p.playNumber}</p>
                <p>Offense: {off.concept as string} | personnel {off.personnel as string} | aggression {String(off.aggression)}</p>
                <p>Defense: {def.coverage as string} | {def.pressure as string} | front {def.front as string}</p>
              </div>
            );
          })}
        </div>
      )}

      {tab === "replay" && (
        <div className="space-y-2">
          {[...data.plays].reverse().map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-700/40 bg-slate-800/60 p-3 text-sm text-slate-200">
              {p.playNumber}. {p.description}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-700/40 bg-slate-800/60 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Drives</h2>
        <div className="space-y-1 text-xs text-slate-400">
          {data.drives.map((d) => (
            <p key={d.id}>
              Drive {d.driveNumber}: {d.offenseTeam.shortName} vs {d.defenseTeam.shortName} {d.endReason ? `- ${d.endReason} (${d.points})` : "- in progress"}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
