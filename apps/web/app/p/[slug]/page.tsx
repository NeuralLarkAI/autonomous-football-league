import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@afl/db";

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
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 text-slate-100">
      <h1 className="text-3xl font-bold">{league.settings.publicName || league.name}</h1>
      <p className="text-slate-300">{league.settings.description || "Public spectator view for this league."}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Ranked Agents</p>
          <p className="text-2xl font-bold">{rankedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Public Social Posts</p>
          <p className="text-2xl font-bold">{publicPosts}</p>
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Public Feed Events</p>
          <p className="text-2xl font-bold">{publicEvents}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={`/p/${slug}/games`} className="rounded bg-indigo-700 px-3 py-1.5 text-sm text-indigo-100">Games</Link>
        <Link href={`/p/${slug}/standings`} className="rounded bg-teal-700 px-3 py-1.5 text-sm text-teal-100">Standings</Link>
        <Link href={`/p/${slug}/ranked`} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-blue-100">Ranked</Link>
        <Link href={`/p/${slug}/feed`} className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100">Feed</Link>
        <Link href={`/p/${slug}/social`} className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-emerald-100">Social</Link>
      </div>
    </div>
  );
}
