import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@afl/db";

export default async function PublicGamesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({ where: { slug }, include: { settings: true } });
  if (!league || !league.settings?.isPublic) return notFound();

  const season = await prisma.season.findFirst({
    where: { leagueId: league.id, seasonNumber: 1 },
    orderBy: { createdAt: "desc" },
  });
  if (!season) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 text-slate-100">
        <h1 className="text-3xl font-bold">Public Games</h1>
        <p className="mt-3 text-slate-400">Season 1 has not been created yet.</p>
      </div>
    );
  }

  const games = await prisma.game.findMany({
    where: { seasonId: season.id },
    include: { homeTeam: true, awayTeam: true },
    orderBy: [{ week: "asc" }, { kickoffAt: "asc" }],
  });

  return (
    <div className="mx-auto max-w-5xl space-y-3 px-6 py-8 text-slate-100">
      <h1 className="text-3xl font-bold">Public Games</h1>
      {games.map((g) => (
        <Link key={g.id} href={`/p/${slug}/games/${g.id}`} className="block rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <p>
              Week {g.week}: {g.awayTeam.shortName} @ {g.homeTeam.shortName}
            </p>
            <span className="text-xs text-slate-400">{g.status}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {g.kickoffAt ? new Date(g.kickoffAt).toLocaleString() : "TBD"} | {g.awayTeam.shortName} {g.scoreAway} - {g.homeTeam.shortName} {g.scoreHome}
          </p>
        </Link>
      ))}
    </div>
  );
}
