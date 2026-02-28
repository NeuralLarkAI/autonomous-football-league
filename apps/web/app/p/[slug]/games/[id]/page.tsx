import { notFound } from "next/navigation";
import { prisma } from "@afl/db";
import { AispnField } from "@/components/aispn-field";

export default async function PublicGameDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const league = await prisma.league.findUnique({ where: { slug }, include: { settings: true } });
  if (!league || !league.settings?.isPublic) return notFound();

  const game = await prisma.game.findFirst({
    where: { id, leagueId: league.id },
    include: { homeTeam: true, awayTeam: true },
  });
  if (!game) return notFound();

  const [plays, boxScore] = await Promise.all([
    prisma.play.findMany({
      where: { gameId: game.id },
      include: { offenseTeam: { select: { shortName: true } }, defenseTeam: { select: { shortName: true } } },
      orderBy: { playNumber: "desc" },
      take: 120,
    }),
    prisma.boxScore.findUnique({ where: { gameId: game.id } }),
  ]);

  const totals = boxScore ? (JSON.parse(boxScore.statsJson) as { totals: Record<string, number> }).totals : null;
  const latest = plays[0] ?? null;
  let fieldState: { qtr: number; timeSeconds: number; down: number; distance: number; yardLine: number } | null = null;
  if (latest) {
    try {
      const parsed = JSON.parse(latest.resultJson) as Partial<{ qtr: number; timeSeconds: number; down: number; distance: number; yardLine: number }>;
      fieldState = {
        qtr: parsed.qtr ?? latest.qtr,
        timeSeconds: parsed.timeSeconds ?? latest.timeSeconds,
        down: parsed.down ?? latest.down,
        distance: parsed.distance ?? latest.distance,
        yardLine: parsed.yardLine ?? latest.yardLine,
      };
    } catch {
      fieldState = {
        qtr: latest.qtr,
        timeSeconds: latest.timeSeconds,
        down: latest.down,
        distance: latest.distance,
        yardLine: latest.yardLine,
      };
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-8 text-slate-100">
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
        <p className="text-xs text-slate-400">Week {game.week} | {game.status}</p>
        <p className="text-2xl font-bold">
          {game.awayTeam.shortName} {game.scoreAway} - {game.homeTeam.shortName} {game.scoreHome}
        </p>
      </div>

      {latest && fieldState && (
        <AispnField
          offenseLabel={latest.offenseTeam?.shortName ?? "OFF"}
          defenseLabel={latest.defenseTeam?.shortName ?? "DEF"}
          down={fieldState.down}
          distance={fieldState.distance}
          yardLine={fieldState.yardLine}
          qtr={fieldState.qtr}
          timeSeconds={fieldState.timeSeconds}
          lastPlay={latest.description}
        />
      )}

      {totals && (
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4 text-sm text-slate-300">
          <p>Plays: {totals.plays}</p>
          <p>Pass Yards: {totals.passYards}</p>
          <p>Rush Yards: {totals.rushYards}</p>
          <p>Turnovers: {totals.turnovers}</p>
        </div>
      )}

      <div className="space-y-2">
        {plays.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-3 text-sm text-slate-200">
            #{p.playNumber} Q{p.qtr} {p.description}
          </div>
        ))}
      </div>
    </div>
  );
}
