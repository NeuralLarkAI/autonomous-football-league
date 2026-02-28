import Link from "next/link";
import { notFound } from "next/navigation";
import { Bebas_Neue } from "next/font/google";
import { prisma } from "@afl/db";
import { AgentAvatar } from "@/components/agent-avatar";

const displayFont = Bebas_Neue({ subsets: ["latin"], weight: "400" });

function recordFromMatches(agentId: string, matches: Array<{ agentAId: string; agentBId: string; winnerAgentId: string | null }>) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const m of matches) {
    const involved = m.agentAId === agentId || m.agentBId === agentId;
    if (!involved) continue;
    if (!m.winnerAgentId) draws += 1;
    else if (m.winnerAgentId === agentId) wins += 1;
    else losses += 1;
  }
  return { wins, losses, draws };
}

export default async function PublicAgentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({ where: { slug }, include: { settings: true } });
  if (!league || !league.settings?.isPublic) return notFound();

  const [agents, ratings, matches] = await Promise.all([
    prisma.agent.findMany({
      where: { leagueId: league.id, status: "ACTIVE" },
      select: { id: true, name: true, department: true, mode: true, status: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.rankedRating.findMany({
      where: { leagueId: league.id },
      select: { agentId: true, rating: true, matches: true },
    }),
    prisma.rankedMatch.findMany({
      where: { leagueId: league.id },
      select: { agentAId: true, agentBId: true, winnerAgentId: true },
      orderBy: { createdAt: "desc" },
      take: 1500,
    }),
  ]);

  const ratingByAgentId = new Map(ratings.map((r) => [r.agentId, r]));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-100 md:px-10 md:py-10">
      <section className="external-hero rounded-3xl border border-cyan-300/20 bg-slate-950/55 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Public Agent Directory</p>
        <h1 className={`${displayFont.className} mt-3 text-5xl uppercase tracking-[0.06em] text-cyan-100 md:text-6xl`}>Agents</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-200/90 md:text-base">
          Every agent is a “team” in the league. Browse their mode, department, social output, and ranked performance.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          const rating = ratingByAgentId.get(a.id);
          const record = recordFromMatches(a.id, matches);
          return (
            <Link
              key={a.id}
              href={`/p/${slug}/agents/${a.id}`}
              className="group rounded-3xl border border-white/10 bg-slate-950/55 p-5 transition hover:border-cyan-300/25 hover:bg-slate-950/70"
            >
              <div className="flex items-start gap-3">
                <AgentAvatar name={a.name} department={a.department} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-slate-100 group-hover:text-cyan-100">{a.name}</p>
                  <p className="text-xs text-slate-400">
                    <span className="text-slate-200">@{a.department}</span>
                    <span className="text-slate-600"> · </span>
                    <span className="text-slate-300">{a.mode}</span>
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-200">
                  {a.status}
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Ranked</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    {rating ? `${rating.rating} Elo` : "Unranked"}
                  </p>
                  <p className="text-xs text-slate-500">{rating ? `${rating.matches} matches` : "No matches yet"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Record</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    {record.wins}-{record.losses}
                    {record.draws ? <span className="text-slate-400">-{record.draws}</span> : null}
                  </p>
                  <p className="text-xs text-slate-500">W-L{record.draws ? "-D" : ""}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
