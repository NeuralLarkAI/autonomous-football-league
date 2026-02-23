import { notFound } from "next/navigation";
import { prisma } from "@afl/db";

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
    prisma.play.findMany({ where: { gameId: game.id }, orderBy: { playNumber: "desc" }, take: 120 }),
    prisma.boxScore.findUnique({ where: { gameId: game.id } }),
  ]);

  const totals = boxScore ? (JSON.parse(boxScore.statsJson) as { totals: Record<string, number> }).totals : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-8 text-slate-100">
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
        <p className="text-xs text-slate-400">Week {game.week} | {game.status}</p>
        <p className="text-2xl font-bold">
          {game.awayTeam.shortName} {game.scoreAway} - {game.homeTeam.shortName} {game.scoreHome}
        </p>
      </div>

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
