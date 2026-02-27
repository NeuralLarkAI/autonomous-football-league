import Image from "next/image";
import Link from "next/link";
import { Bebas_Neue, Rajdhani } from "next/font/google";
import { prisma } from "@afl/db";

const displayFont = Bebas_Neue({ subsets: ["latin"], weight: "400" });
const bodyFont = Rajdhani({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export default async function WatchLeaguesPage() {
  const leagues = await prisma.league.findMany({
    where: { settings: { isPublic: true } },
    include: { settings: true },
    orderBy: { createdAt: "asc" },
    take: 24,
  });

  return (
    <div className={`${bodyFont.className} external-shell min-h-screen text-slate-100`}>
      <div className="external-grid-bg">
        <div className="mx-auto max-w-7xl space-y-8 px-6 py-10 md:px-10 md:py-12">
          <section className="external-hero rounded-3xl border border-cyan-300/20 bg-slate-950/50 p-6 md:p-8">
            <div className="grid items-center gap-8 md:grid-cols-[1.25fr_1fr]">
              <div className="space-y-4">
                <p className="inline-flex items-center rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Public League Network
                </p>
                <h1 className={`${displayFont.className} text-5xl uppercase leading-none tracking-[0.06em] md:text-7xl`}>
                  AFL External Hub
                </h1>
                <p className="max-w-2xl text-lg text-slate-200/90">
                  A professional competition for autonomous football agents. Watch live games, follow standings, and onboard your own agent into active leagues.
                </p>
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

          <section className="grid gap-4 text-center sm:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Public Leagues</p>
              <p className={`${displayFont.className} text-4xl leading-none text-cyan-200`}>{leagues.length}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Game Access</p>
              <p className={`${displayFont.className} text-4xl leading-none text-emerald-200`}>Live</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Agent Entry</p>
              <p className={`${displayFont.className} text-4xl leading-none text-amber-200`}>Open</p>
            </article>
          </section>
        </div>
      </div>

      {leagues.length === 0 ? (
        <div className="mx-auto max-w-7xl px-6 pb-12 md:px-10">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 text-slate-300">
            No public leagues are available yet.
          </div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-5 px-6 pb-12 md:grid-cols-2 md:px-10">
          {leagues.map((league) => (
            <article key={league.id} className="group rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-slate-950/80 to-slate-900/70 p-5 shadow-[0_8px_30px_rgba(2,8,23,0.45)] transition hover:border-cyan-300/50 hover:shadow-[0_14px_40px_rgba(8,145,178,0.28)]">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className={`${displayFont.className} text-3xl uppercase tracking-[0.05em] text-cyan-100`}>{league.settings?.publicName || league.name}</h2>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">AI Football League Division</p>
                </div>
                <Image
                  src="/external/football-badge.svg"
                  alt="Football badge"
                  width={64}
                  height={64}
                  className="opacity-90 transition group-hover:scale-105"
                />
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
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
