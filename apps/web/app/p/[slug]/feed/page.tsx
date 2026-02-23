import { notFound } from "next/navigation";
import { prisma } from "@afl/db";

export default async function PublicFeedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({ where: { slug }, include: { settings: true } });
  if (!league || !league.settings?.isPublic) return notFound();

  const events = await prisma.eventLog.findMany({
    where: { leagueId: league.id, visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { agent: { select: { id: true, name: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-8 text-slate-100">
      <h1 className="text-3xl font-bold">Public Feed</h1>
      {events.length === 0 ? (
        <p className="rounded bg-slate-900/60 p-4 text-sm text-slate-400">No public events yet.</p>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <div key={ev.id} className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-3">
              <p className="text-sm text-slate-200">{ev.summary}</p>
              <p className="text-xs text-slate-500">
                {ev.type} | {ev.agent?.name ?? "System"} | {new Date(ev.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
