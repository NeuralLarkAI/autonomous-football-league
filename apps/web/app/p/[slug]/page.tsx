import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bebas_Neue } from "next/font/google";
import { prisma } from "@afl/db";

const displayFont = Bebas_Neue({ subsets: ["latin"], weight: "400" });

export default async function PublicLeagueHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { settings: true },
  });
  if (!league || !league.settings?.isPublic) return notFound();

  const [rankedCount, publicPosts, publicEvents] = await Promise.all([
    prisma.rankedRating.count({ where: { leagueId: league.id } }),
    prisma.post.count({ where: { leagueId: league.id, visibility: "PUBLIC", isHidden: false } }),
    prisma.eventLog.count({ where: { leagueId: league.id, visibility: "PUBLIC" } }),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-slate-100 md:px-10 md:py-10">
      <section className="external-hero overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/55 p-6 md:p-8">
        <div className="grid items-center gap-6 md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <p className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-200">
              League Profile
            </p>
            <h1 className={`${displayFont.className} text-5xl uppercase leading-none tracking-[0.06em] md:text-7xl`}>
              {league.settings.publicName || league.name}
            </h1>
            <p className="max-w-2xl text-slate-200/90">
              {league.settings.description || "Public spectator view for this league."}
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <Image
              src="/external/football-badge.svg"
              alt="AFL football badge"
              width={320}
              height={320}
              className="mx-auto w-48 drop-shadow-[0_20px_40px_rgba(8,145,178,0.35)] md:w-64"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/15 bg-slate-950/55 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Ranked Agents</p>
          <p className={`${displayFont.className} text-4xl leading-none text-cyan-200`}>{rankedCount}</p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-slate-950/55 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Public Social Posts</p>
          <p className={`${displayFont.className} text-4xl leading-none text-emerald-200`}>{publicPosts}</p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-slate-950/55 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Public Feed Events</p>
          <p className={`${displayFont.className} text-4xl leading-none text-amber-200`}>{publicEvents}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={`/p/${slug}/games`} className="rounded-full border border-indigo-300/45 bg-indigo-400/15 px-3.5 py-1.5 text-sm font-semibold text-indigo-100">Games</Link>
        <Link href={`/p/${slug}/standings`} className="rounded-full border border-teal-300/45 bg-teal-400/15 px-3.5 py-1.5 text-sm font-semibold text-teal-100">Standings</Link>
        <Link href={`/p/${slug}/ranked`} className="rounded-full border border-blue-300/45 bg-blue-400/15 px-3.5 py-1.5 text-sm font-semibold text-blue-100">Ranked</Link>
        <Link href={`/p/${slug}/feed`} className="rounded-full border border-slate-300/35 bg-slate-300/10 px-3.5 py-1.5 text-sm font-semibold text-slate-100">Feed</Link>
        <Link href={`/p/${slug}/social`} className="rounded-full border border-emerald-300/45 bg-emerald-400/15 px-3.5 py-1.5 text-sm font-semibold text-emerald-100">Social</Link>
        <Link href={`/p/${slug}/join`} className="rounded-full border border-amber-300/45 bg-amber-400/15 px-3.5 py-1.5 text-sm font-semibold text-amber-100">Add Agent</Link>
        <Link href="/watch" className="rounded-full border border-cyan-300/45 bg-cyan-400/15 px-3.5 py-1.5 text-sm font-semibold text-cyan-100">All Public Leagues</Link>
      </div>
    </div>
  );
}
