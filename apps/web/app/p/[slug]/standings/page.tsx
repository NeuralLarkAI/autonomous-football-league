import Link from "next/link";
import { notFound } from "next/navigation";
import { Bebas_Neue } from "next/font/google";
import { prisma } from "@afl/db";
import { Fragment } from "react";

const displayFont = Bebas_Neue({ subsets: ["latin"], weight: "400" });

type RecordLine = { wins: number; losses: number; ties: number };

function recordString(r: RecordLine) {
  return `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ""}`;
}

function addResult(record: RecordLine, winnerTeamId: string | null, teamId: string) {
  if (!winnerTeamId) record.ties += 1;
  else if (winnerTeamId === teamId) record.wins += 1;
  else record.losses += 1;
}

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

  const [rows, games] = await Promise.all([
    prisma.standingsRow.findMany({
      where: { seasonId: season.id },
      include: { team: true },
      orderBy: [{ wins: "desc" }, { losses: "asc" }, { ties: "desc" }, { pointsFor: "desc" }],
    }),
    prisma.game.findMany({
      where: { seasonId: season.id },
      select: { id: true, week: true, status: true, homeTeamId: true, awayTeamId: true, winnerTeamId: true },
      orderBy: [{ week: "asc" }],
    }),
  ]);

  const currentWeek =
    games
      .filter((g) => g.status === "LIVE" || g.status === "FINAL")
      .sort((a, b) => b.week - a.week)[0]?.week ??
    games
      .filter((g) => g.status === "SCHEDULED")
      .sort((a, b) => a.week - b.week)[0]?.week ??
    null;

  const homeByTeam = new Map<string, RecordLine>();
  const awayByTeam = new Map<string, RecordLine>();

  for (const g of games) {
    if (g.status !== "FINAL") continue;
    const home = homeByTeam.get(g.homeTeamId) ?? { wins: 0, losses: 0, ties: 0 };
    const away = awayByTeam.get(g.awayTeamId) ?? { wins: 0, losses: 0, ties: 0 };
    addResult(home, g.winnerTeamId, g.homeTeamId);
    addResult(away, g.winnerTeamId, g.awayTeamId);
    homeByTeam.set(g.homeTeamId, home);
    awayByTeam.set(g.awayTeamId, away);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 text-slate-100 md:px-10">
      <section className="external-hero overflow-hidden rounded-3xl border border-teal-300/20 bg-slate-950/55 p-6 shadow-[0_12px_50px_rgba(2,8,23,0.55)] md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">AISPN</p>
            <h1 className={`${displayFont.className} text-5xl uppercase tracking-[0.06em] md:text-7xl`}>Standings</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200/90 md:text-base">
              Season 1 table for {league.settings.publicName || league.name}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {typeof currentWeek === "number" ? (
              <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
                Week {currentWeek}
              </span>
            ) : null}
            <Link
              href={`/p/${slug}/games`}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-100 hover:bg-white/10"
            >
              Schedule →
            </Link>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-slate-950/55">
        <table className="min-w-full text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">RK</th>
              <th className="px-4 py-3 text-left">Team</th>
              <th className="px-4 py-3 text-left">W-L-T</th>
              <th className="px-4 py-3 text-left">PF</th>
              <th className="px-4 py-3 text-left">PA</th>
              <th className="px-4 py-3 text-left">Home</th>
              <th className="px-4 py-3 text-left">Away</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row, idx) => {
              const home = homeByTeam.get(row.teamId) ?? { wins: 0, losses: 0, ties: 0 };
              const away = awayByTeam.get(row.teamId) ?? { wins: 0, losses: 0, ties: 0 };
              const tone = idx % 2 === 0 ? "bg-slate-950/10" : "bg-transparent";
              const isCutline = idx === 4;
              return (
                <Fragment key={row.id}>
                  {isCutline ? (
                    <tr key="cutline">
                      <td colSpan={7} className="bg-slate-950/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Playoff Cutline
                      </td>
                    </tr>
                  ) : null}
                  <tr className={tone}>
                    <td className="px-4 py-3 text-slate-300">#{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-100">{row.team.name}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-slate-100">{recordString(row)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-200">{row.pointsFor}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-200">{row.pointsAgainst}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{recordString(home)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{recordString(away)}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
