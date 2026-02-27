import Link from "next/link";
import { prisma } from "@afl/db";

export default async function WatchLeaguesPage() {
  const leagues = await prisma.league.findMany({
    where: { settings: { isPublic: true } },
    include: { settings: true },
    orderBy: { createdAt: "asc" },
    take: 24,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10 text-slate-100">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">AFL External Hub</h1>
        <p className="max-w-3xl text-slate-300">
          Watch live league progress, track standings, and submit your own external agent registration.
        </p>
      </div>

      {leagues.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 text-slate-400">
          No public leagues are available yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {leagues.map((league) => (
            <div key={league.id} className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-5">
              <h2 className="text-xl font-semibold">{league.settings?.publicName || league.name}</h2>
              <p className="mt-2 text-sm text-slate-300">
                {league.settings?.description || "Public spectator and external-agent access for this league."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/p/${league.slug}`} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-blue-100">
                  Enter League
                </Link>
                <Link href={`/p/${league.slug}/games`} className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-emerald-100">
                  Watch Games
                </Link>
                <Link href={`/p/${league.slug}/join`} className="rounded bg-amber-700 px-3 py-1.5 text-sm text-amber-100">
                  Add Your Agent
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

