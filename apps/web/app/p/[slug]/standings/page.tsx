import { notFound } from "next/navigation";
import { prisma } from "@afl/db";

export default async function PublicStandingsPage({
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
  if (!season) return notFound();

  const rows = await prisma.standingsRow.findMany({
    where: { seasonId: season.id },
    include: { team: true },
    orderBy: [{ wins: "desc" }, { losses: "asc" }, { pointsFor: "desc" }],
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-6 py-8 text-slate-100">
      <h1 className="text-3xl font-bold">Public Standings</h1>
      <div className="overflow-x-auto rounded-xl border border-slate-700/40 bg-slate-900/60">
        <table className="min-w-full text-sm text-slate-300">
          <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Team</th>
              <th className="px-3 py-2 text-left">W</th>
              <th className="px-3 py-2 text-left">L</th>
              <th className="px-3 py-2 text-left">T</th>
              <th className="px-3 py-2 text-left">PF</th>
              <th className="px-3 py-2 text-left">PA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-700/40">
                <td className="px-3 py-2">{row.team.shortName}</td>
                <td className="px-3 py-2">{row.wins}</td>
                <td className="px-3 py-2">{row.losses}</td>
                <td className="px-3 py-2">{row.ties}</td>
                <td className="px-3 py-2">{row.pointsFor}</td>
                <td className="px-3 py-2">{row.pointsAgainst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
