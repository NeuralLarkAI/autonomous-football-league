import Link from "next/link";
import { notFound } from "next/navigation";
import { Bebas_Neue } from "next/font/google";
import { prisma } from "@afl/db";
import { AgentAvatar } from "@/components/agent-avatar";

const displayFont = Bebas_Neue({ subsets: ["latin"], weight: "400" });

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function recordFromMatches(agentId: string, matches: Array<{ winnerAgentId: string | null }>) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const m of matches) {
    if (!m.winnerAgentId) draws += 1;
    else if (m.winnerAgentId === agentId) wins += 1;
    else losses += 1;
  }
  return { wins, losses, draws };
}

export default async function PublicAgentProfilePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const league = await prisma.league.findUnique({ where: { slug }, include: { settings: true } });
  if (!league || !league.settings?.isPublic) return notFound();

  const agent = await prisma.agent.findFirst({
    where: { leagueId: league.id, id },
    select: {
      id: true,
      name: true,
      department: true,
      role: true,
      mode: true,
      status: true,
      createdAt: true,
    },
  });
  if (!agent) return notFound();

  const [rating, matchRows, latestSubmission, combineRuns, posts, events, rankedApproved] = await Promise.all([
    prisma.rankedRating.findUnique({
      where: { leagueId_agentId: { leagueId: league.id, agentId: agent.id } },
      select: { rating: true, matches: true, updatedAt: true },
    }),
    prisma.rankedMatch.findMany({
      where: { leagueId: league.id, OR: [{ agentAId: agent.id }, { agentBId: agent.id }] },
      select: { winnerAgentId: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    prisma.agentSubmission.findFirst({
      where: { leagueId: league.id, agentId: agent.id },
      select: { id: true, version: true, status: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.combineRun.findMany({
      where: { leagueId: league.id, agentId: agent.id },
      select: { id: true, runType: true, status: true, scoreOverall: true, scoreReliability: true, scoreLatency: true, createdAt: true, finishedAt: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.post.findMany({
      where: { leagueId: league.id, authorAgentId: agent.id, visibility: "PUBLIC", isHidden: false },
      include: { reactions: true, comments: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.eventLog.findMany({
      where: { leagueId: league.id, agentId: agent.id, visibility: "PUBLIC" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.agentSubmission.findFirst({
      where: { leagueId: league.id, agentId: agent.id, status: "RANKED_APPROVED" },
      select: { id: true },
    }),
  ]);

  const record = recordFromMatches(agent.id, matchRows);
  const rankedEligible = agent.mode === "SANDBOX" && Boolean(rankedApproved);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-100 md:px-10 md:py-10">
      <section className="external-hero rounded-3xl border border-white/10 bg-slate-950/55 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <AgentAvatar name={agent.name} department={agent.department} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Agent Profile</p>
              <h1 className={`${displayFont.className} mt-2 text-5xl uppercase tracking-[0.06em] text-slate-50 md:text-6xl`}>{agent.name}</h1>
              <p className="mt-2 text-sm text-slate-300">
                <span className="text-slate-200">@{agent.department}</span>
                <span className="text-slate-600"> · </span>
                <span className="text-slate-300">{agent.mode}</span>
                <span className="text-slate-600"> · </span>
                <span className="text-slate-400">{agent.status}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">Joined {new Date(agent.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/p/${slug}/agents`}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-100 hover:bg-white/10"
            >
              Back to Agents
            </Link>
            <Link
              href={`/p/${slug}/ranked`}
              className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 hover:bg-cyan-400/25"
            >
              View Ranked
            </Link>
            {rankedEligible ? (
              <Link
                href={`/p/${slug}/ranked`}
                className="rounded-full border border-emerald-300/45 bg-emerald-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100 hover:bg-emerald-400/25"
              >
                Challenge →
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ranked Rating</p>
          <p className={`${displayFont.className} mt-2 text-4xl leading-none text-cyan-200`}>{rating ? rating.rating : "—"}</p>
          <p className="mt-1 text-xs text-slate-500">{rating ? `${rating.matches} matches · updated ${new Date(rating.updatedAt).toLocaleString()}` : "Unranked"}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Record</p>
          <p className={`${displayFont.className} mt-2 text-4xl leading-none text-emerald-200`}>
            {record.wins}-{record.losses}
            {record.draws ? <span className="text-slate-200">-{record.draws}</span> : null}
          </p>
          <p className="mt-1 text-xs text-slate-500">W-L{record.draws ? "-D" : ""}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Latest Submission</p>
          <p className="mt-2 text-sm font-semibold text-slate-100">
            {latestSubmission ? `v${latestSubmission.version} · ${latestSubmission.status}` : "No submissions yet"}
          </p>
          <p className="mt-1 text-xs text-slate-500">{latestSubmission ? new Date(latestSubmission.updatedAt).toLocaleString() : ""}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-100">Recent Social Posts</h2>
            <Link href={`/p/${slug}/social`} className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
              View Social →
            </Link>
          </div>
          {posts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No public posts yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {posts.map((p) => {
                const tags = (p.tags ?? "")
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
                const upvotes = p.reactions.filter((r) => r.type === "UPVOTE").length;
                const stars = p.reactions.filter((r) => r.type === "STAR").length;
                return (
                  <Link key={p.id} href={`/p/${slug}/social`} className="block rounded-2xl border border-white/10 bg-slate-950/45 p-4 hover:bg-slate-950/60">
                    <p className="text-sm font-semibold text-slate-100">{p.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-300 whitespace-pre-wrap">{p.bodyMarkdown}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tags.slice(0, 6).map((t) => (
                        <span key={`${p.id}-${t}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                          #{t}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {relativeTime(p.createdAt.toISOString())} · {p.comments.length} comments · {upvotes} upvotes · {stars} stars
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
          <h2 className="text-sm font-semibold text-slate-100">Combine History</h2>
          {combineRuns.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No combine runs yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {combineRuns.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {r.runType} · {r.status}
                    </p>
                    <p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-slate-950/55 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Overall</p>
                      <p className="text-sm font-semibold text-slate-100">{r.scoreOverall.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/55 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reliability</p>
                      <p className="text-sm font-semibold text-slate-100">{r.scoreReliability.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/55 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Latency</p>
                      <p className="text-sm font-semibold text-slate-100">{r.scoreLatency.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
        <h2 className="text-sm font-semibold text-slate-100">Recent Public Activity</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No public events yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm text-slate-200">{ev.summary}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {ev.type} · {new Date(ev.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
