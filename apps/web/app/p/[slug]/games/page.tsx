import Link from "next/link";
import { notFound } from "next/navigation";
import { Bebas_Neue } from "next/font/google";
import { prisma } from "@afl/db";

const displayFont = Bebas_Neue({ subsets: ["latin"], weight: "400" });

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

  const weeks = Array.from(new Set(games.map((g) => g.week))).sort((a, b) => a - b);
  const liveGames = games.filter((g) => g.status === "LIVE");

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 text-slate-100 md:px-10">
      <section className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/55 p-6 shadow-[0_12px_50px_rgba(2,8,23,0.55)] md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">AISPN</p>
            <h1 className={`${displayFont.className} text-5xl uppercase tracking-[0.06em] md:text-7xl`}>Game Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200/90">
              Live play-by-play, field view, and box scores for {league.settings.publicName || league.name}.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Live Now</p>
            <p className={`${displayFont.className} mt-1 text-4xl leading-none text-rose-200`}>{liveGames.length}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/p/${slug}`}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
          >
            League Home
          </Link>
          <Link
            href={`/p/${slug}/standings`}
            className="rounded-full border border-teal-300/45 bg-teal-400/15 px-4 py-2 text-sm font-semibold text-teal-100 hover:bg-teal-400/25"
          >
            Standings
          </Link>
          <Link
            href={`/p/${slug}/ranked`}
            className="rounded-full border border-blue-300/45 bg-blue-400/15 px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-blue-400/25"
          >
            Ranked
          </Link>
        </div>
      </section>

      {games.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 text-slate-300">
          No games scheduled yet.
        </div>
      ) : (
        <div className="space-y-6">
          {weeks.map((week) => {
            const weekGames = games.filter((g) => g.week === week);
            return (
              <section key={week} className="space-y-3">
                <div className="flex items-end justify-between">
                  <h2 className={`${displayFont.className} text-3xl uppercase tracking-[0.06em] text-cyan-100`}>Week {week}</h2>
                  <p className="text-xs text-slate-500">{weekGames.length} game(s)</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {weekGames.map((g) => {
                    const statusPill =
                      g.status === "LIVE"
                        ? "bg-rose-600/20 text-rose-200 ring-rose-500/30"
                        : g.status === "FINAL"
                          ? "bg-emerald-700/20 text-emerald-200 ring-emerald-500/30"
                          : "bg-slate-600/20 text-slate-200 ring-slate-500/30";

                    const statusLabel =
                      g.status === "LIVE" ? "LIVE" : g.status === "FINAL" ? "FINAL" : "UPCOMING";

                    return (
                      <Link
                        key={g.id}
                        href={`/p/${slug}/games/${g.id}`}
                        className="group block rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/75 to-slate-900/55 p-5 shadow-[0_10px_35px_rgba(2,8,23,0.55)] transition hover:border-cyan-300/35 hover:shadow-[0_16px_55px_rgba(8,145,178,0.22)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">GameCast</p>
                            <div className="space-y-1">
                              <div className="flex items-baseline justify-between gap-4">
                                <p className={`text-2xl font-black tracking-tight text-slate-100 ${displayFont.className}`}>{g.awayTeam.shortName}</p>
                                <p className="text-3xl font-black tabular-nums text-slate-100">{g.status === "SCHEDULED" ? "—" : g.scoreAway}</p>
                              </div>
                              <div className="flex items-baseline justify-between gap-4">
                                <p className={`text-2xl font-black tracking-tight text-slate-100 ${displayFont.className}`}>{g.homeTeam.shortName}</p>
                                <p className="text-3xl font-black tabular-nums text-slate-100">{g.status === "SCHEDULED" ? "—" : g.scoreHome}</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusPill}`}>
                              {g.status === "LIVE" ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
                                  </span>
                                  {statusLabel}
                                </span>
                              ) : (
                                statusLabel
                              )}
                            </span>
                            <p className="mt-2 text-xs text-slate-400">
                              {g.kickoffAt ? new Date(g.kickoffAt).toLocaleString() : "TBD"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-400">
                          <p className="truncate">
                            {g.awayTeam.name} @ {g.homeTeam.name}
                          </p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200 transition group-hover:bg-white/10">
                            {g.status === "LIVE" ? "Watch" : g.status === "FINAL" ? "Recap" : "Preview"}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
