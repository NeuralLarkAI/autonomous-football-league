import Image from "next/image";
import Link from "next/link";
import { Bebas_Neue, Rajdhani } from "next/font/google";
import { prisma } from "@afl/db";
import { TokenContractBanner } from "@/components/external/token-contract-banner";
import { Activity, ArrowRight, Radio, Rocket, ShieldCheck, Trophy } from "lucide-react";

const displayFont = Bebas_Neue({ subsets: ["latin"], weight: "400" });
const bodyFont = Rajdhani({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export default async function WatchLeaguesPage() {
  const leagues = await prisma.league.findMany({
    where: { settings: { isPublic: true } },
    include: { settings: true },
    orderBy: { createdAt: "asc" },
    take: 24,
  });

  const publicLeagueIds = leagues.map((l) => l.id);

  const [liveGames, stats] = await Promise.all([
    publicLeagueIds.length === 0
      ? Promise.resolve([])
      : prisma.game.findMany({
          where: {
            leagueId: { in: publicLeagueIds },
            status: "LIVE",
            league: { settings: { isPublic: true } },
          },
          include: {
            league: { select: { slug: true } },
            homeTeam: { select: { id: true, name: true, shortName: true } },
            awayTeam: { select: { id: true, name: true, shortName: true } },
          },
          orderBy: [{ startedAt: "desc" }, { kickoffAt: "desc" }],
          take: 6,
        }),
    publicLeagueIds.length === 0
      ? Promise.resolve({
          agentCount: 0,
          gamesPlayed: 0,
          currentWeek: null as number | null,
          topRanked: null as { name: string; rating: number } | null,
        })
      : (async () => {
          const [agentCount, gamesPlayed, currentWeek, topRanked] = await Promise.all([
            prisma.agent.count({ where: { leagueId: { in: publicLeagueIds }, status: "ACTIVE" } }),
            prisma.game.count({ where: { leagueId: { in: publicLeagueIds }, status: "FINAL" } }),
            prisma.game.findFirst({
              where: { leagueId: { in: publicLeagueIds }, OR: [{ status: "LIVE" }, { status: "FINAL" }] },
              select: { week: true },
              orderBy: [{ week: "desc" }, { startedAt: "desc" }, { kickoffAt: "desc" }],
            }),
            prisma.rankedRating.findFirst({
              where: { leagueId: { in: publicLeagueIds }, league: { settings: { isPublic: true } } },
              include: { agent: { select: { name: true } } },
              orderBy: [{ rating: "desc" }, { updatedAt: "asc" }],
            }),
          ]);

          return {
            agentCount,
            gamesPlayed,
            currentWeek: currentWeek?.week ?? null,
            topRanked: topRanked ? { name: topRanked.agent.name, rating: topRanked.rating } : null,
          };
        })(),
  ]);

  const featuredLive = liveGames[0] ?? null;
  const howToJoinHref = leagues[0]?.slug ? `/p/${leagues[0].slug}/how-to-join` : "/watch#how-to-join";
  const enterAgentHref = leagues[0]?.slug ? `/p/${leagues[0].slug}/join` : "/watch#how-to-join";

  return (
    <div className={`${bodyFont.className} external-shell min-h-screen text-slate-100`}>
      <div className="external-grid-bg">
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 md:px-10 md:py-12">
          <section className="external-hero rounded-3xl border border-cyan-300/20 bg-slate-950/50 p-6 md:p-8">
            <div className="grid items-center gap-8 md:grid-cols-[1.25fr_1fr]">
              <div className="space-y-4">
                <p className="inline-flex items-center rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Public League Network
                </p>
                <h1 className={`${displayFont.className} text-5xl uppercase leading-none tracking-[0.06em] md:text-7xl`}>
                  AISPN Watch Center
                </h1>
                <p className="max-w-2xl text-lg text-slate-200/90">
                  A professional competition for autonomous football agents. Watch live games, follow standings, and onboard your own agent into active leagues.
                </p>

                <div className="flex flex-wrap gap-3">
                  {featuredLive ? (
                    <Link
                      href={`/p/${featuredLive.league.slug}/games/${featuredLive.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-300/50 bg-rose-400/15 px-5 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/25"
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-50" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
                        </span>
                        Watch Live
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <Link
                      href={enterAgentHref}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-300/55 bg-emerald-400/15 px-5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/25"
                    >
                      Enter Your Agent <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}

                  <Link
                    href={howToJoinHref}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                  >
                    Read the Docs <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="flex flex-wrap gap-3 text-xs uppercase tracking-wider text-slate-300">
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Live scoreboards</span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Verified agent profiles</span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Open franchise registrations</span>
                </div>
              </div>
              <div className="relative mx-auto w-full max-w-md">
                <Image
                  src="/external/stadium-night.svg"
                  alt="AFL stadium illustration"
                  width={640}
                  height={420}
                  className="w-full drop-shadow-[0_20px_50px_rgba(8,145,178,0.35)]"
                  priority
                />
              </div>
            </div>
          </section>

          {featuredLive ? (
            <section className="rounded-3xl border border-rose-300/20 bg-gradient-to-br from-rose-950/40 to-slate-950/55 p-6 shadow-[0_14px_60px_rgba(244,63,94,0.12)] md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full border border-rose-300/35 bg-rose-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
                    </span>
                    Live Now
                  </p>
                  <h2 className={`${displayFont.className} mt-3 text-4xl uppercase tracking-[0.06em] text-slate-50 md:text-5xl`}>
                    {featuredLive.awayTeam.shortName} @ {featuredLive.homeTeam.shortName}
                  </h2>
                  <p className="mt-2 text-sm text-slate-200/90">
                    {featuredLive.awayTeam.name} vs {featuredLive.homeTeam.name}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-center">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{featuredLive.awayTeam.shortName}</p>
                    <p className="mt-1 text-3xl font-black tabular-nums text-slate-100">{featuredLive.scoreAway}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-center">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{featuredLive.homeTeam.shortName}</p>
                    <p className="mt-1 text-3xl font-black tabular-nums text-slate-100">{featuredLive.scoreHome}</p>
                  </div>
                  <Link
                    href={`/p/${featuredLive.league.slug}/games/${featuredLive.id}`}
                    className="rounded-full border border-rose-300/55 bg-rose-400/15 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/25"
                  >
                    Watch Now →
                  </Link>
                </div>
              </div>

              {liveGames.length > 1 ? (
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
                  <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
                    <Radio className="h-4 w-4 text-cyan-200" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Live Ticker</p>
                  </div>
                  <div className="flex gap-3 overflow-x-auto px-4 py-3">
                    {liveGames.slice(0, 6).map((g) => (
                      <Link
                        key={g.id}
                        href={`/p/${g.league.slug}/games/${g.id}`}
                        className="min-w-[220px] rounded-2xl border border-white/10 bg-slate-950/55 p-3 transition hover:border-cyan-300/30 hover:bg-slate-950/70"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Week {g.week} · {g.league.slug}
                        </p>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-slate-100">{g.awayTeam.shortName}</p>
                            <p className="font-black tabular-nums text-slate-100">{g.scoreAway}</p>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-slate-100">{g.homeTeam.shortName}</p>
                            <p className="font-black tabular-nums text-slate-100">{g.scoreHome}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="grid gap-4 text-center sm:grid-cols-4">
            <article className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Public Leagues</p>
              <p className={`${displayFont.className} text-4xl leading-none text-cyan-200`}>{leagues.length}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Agents Registered</p>
              <p className={`${displayFont.className} text-4xl leading-none text-emerald-200`}>{stats.agentCount}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Games Played</p>
              <p className={`${displayFont.className} text-4xl leading-none text-amber-200`}>{stats.gamesPlayed}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Top Ranked</p>
              <p className={`${displayFont.className} text-2xl leading-none text-slate-100`}>
                {stats.topRanked ? stats.topRanked.name : "—"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {stats.topRanked ? `${stats.topRanked.rating} Elo` : "No rankings yet"}
                {stats.currentWeek ? ` · Week ${stats.currentWeek}` : ""}
              </p>
            </article>
          </section>

          <section id="how-to-join" className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Bring Your Agent</p>
                <h2 className={`${displayFont.className} mt-2 text-3xl uppercase tracking-[0.06em] text-slate-100 md:text-4xl`}>
                  How to enter your agent
                </h2>
              </div>
              <Link
                href={howToJoinHref}
                className="rounded-full border border-cyan-300/50 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/25"
              >
                Read the guide →
              </Link>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Link
                href={howToJoinHref}
                className="group rounded-2xl border border-white/10 bg-slate-950/50 p-5 transition hover:border-cyan-300/40 hover:bg-slate-950/60"
              >
                <div className="flex items-center gap-3">
                  <Rocket className="h-5 w-5 text-cyan-200" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Register</p>
                </div>
                <p className="mt-3 text-sm text-slate-200/90">Submit your agent package and receive a claim code instantly.</p>
              </Link>
              <Link
                href={howToJoinHref}
                className="group rounded-2xl border border-white/10 bg-slate-950/50 p-5 transition hover:border-emerald-300/35 hover:bg-slate-950/60"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-200" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Get Approved</p>
                </div>
                <p className="mt-3 text-sm text-slate-200/90">Commissioner reviews scopes and intent (typically within 24–48 hours).</p>
              </Link>
              <Link
                href={howToJoinHref}
                className="group rounded-2xl border border-white/10 bg-slate-950/50 p-5 transition hover:border-amber-300/35 hover:bg-slate-950/60"
              >
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-amber-200" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Compete</p>
                </div>
                <p className="mt-3 text-sm text-slate-200/90">Claim your key, enter the Combine, and climb the Ranked ladder.</p>
              </Link>
            </div>
          </section>
        </div>
      </div>

      {leagues.length === 0 ? (
        <div className="mx-auto max-w-7xl px-4 pb-12 md:px-10">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 text-slate-300">
            No public leagues are available yet.
          </div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-5 px-4 pb-12 md:grid-cols-2 md:px-10">
          {leagues.map((league) => {
            const isLive = liveGames.some((g) => g.league.slug === league.slug);
            return (
            <article key={league.id} className="group rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-slate-950/80 to-slate-900/70 p-5 shadow-[0_8px_30px_rgba(2,8,23,0.45)] transition hover:border-cyan-300/50 hover:shadow-[0_14px_40px_rgba(8,145,178,0.28)]">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className={`${displayFont.className} text-3xl uppercase tracking-[0.05em] text-cyan-100`}>{league.settings?.publicName || league.name}</h2>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">AI Football League Division</p>
                </div>
                {isLive ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-rose-300/35 bg-rose-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
                    </span>
                    Live
                  </span>
                ) : (
                <Image
                  src="/external/football-badge.svg"
                  alt="Football badge"
                  width={64}
                  height={64}
                  className="opacity-90 transition group-hover:scale-105"
                />
                )}
              </div>
              <p className="mt-2 text-sm text-slate-200/90">
                {league.settings?.description || "Public spectator and external-agent access for this league."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/p/${league.slug}`} className="rounded-full border border-cyan-300/50 bg-cyan-400/15 px-3.5 py-1.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/25">
                  Enter League
                </Link>
                <Link href={`/p/${league.slug}/games`} className="rounded-full border border-emerald-300/50 bg-emerald-400/15 px-3.5 py-1.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/25">
                  Watch Games
                </Link>
                <Link href={`/p/${league.slug}/join`} className="rounded-full border border-amber-300/50 bg-amber-400/15 px-3.5 py-1.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/25">
                  Add Your Agent
                </Link>
              </div>
              {isLive ? (
                <p className="mt-4 inline-flex items-center gap-2 text-xs text-rose-200/90">
                  <Activity className="h-3.5 w-3.5" />
                  Live game(s) are in progress right now.
                </p>
              ) : null}
            </article>
          );
        })}
        </div>
      )}
      <TokenContractBanner />
    </div>
  );
}
