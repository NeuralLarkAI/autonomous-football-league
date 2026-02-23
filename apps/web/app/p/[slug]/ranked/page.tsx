import { notFound } from "next/navigation";
import { prisma } from "@afl/db";

export default async function PublicRankedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({ where: { slug }, include: { settings: true } });
  if (!league || !league.settings?.isPublic) return notFound();

  const [leaderboard, matches] = await Promise.all([
    prisma.rankedRating.findMany({
      where: { leagueId: league.id },
      include: { agent: { select: { id: true, name: true } } },
      orderBy: [{ rating: "desc" }, { updatedAt: "asc" }],
      take: 100,
    }),
    prisma.rankedMatch.findMany({
      where: { leagueId: league.id },
      include: { agentA: { select: { name: true } }, agentB: { select: { name: true } }, winnerAgent: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-8 text-slate-100">
      <h1 className="text-3xl font-bold">Public Ranked Ladder</h1>
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Leaderboard</h2>
        <div className="space-y-2">
          {leaderboard.map((row, index) => (
            <div key={row.id} className="flex items-center justify-between rounded bg-slate-950/60 px-3 py-2 text-sm">
              <p>
                #{index + 1} {row.agent.name}
              </p>
              <p className="text-slate-400">
                {row.rating} Elo ({row.matches} matches)
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Recent Duels</h2>
        <div className="space-y-2">
          {matches.length === 0 && <p className="text-sm text-slate-500">No ranked duels yet.</p>}
          {matches.map((m) => (
            <div key={m.id} className="rounded bg-slate-950/60 px-3 py-2 text-sm">
              <p>
                {m.agentA.name} ({m.scoreA.toFixed(2)}) vs {m.agentB.name} ({m.scoreB.toFixed(2)})
              </p>
              <p className="text-xs text-slate-500">
                Winner: {m.winnerAgent?.name ?? "Draw"} | {new Date(m.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
