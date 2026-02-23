import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { RunRankedDuelSchema } from "@afl/core";
import { getSessionUser } from "@/lib/auth";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";
import { runSubmissionCombine } from "@/lib/submission-combine";
import { applyElo, getOrCreateRating } from "@/lib/ranked";

async function latestApprovedSubmission(leagueId: string, agentId: string) {
  return prisma.agentSubmission.findFirst({
    where: { leagueId, agentId, status: "RANKED_APPROVED" },
    include: { artifacts: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { version: "desc" },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const ratings = await prisma.rankedRating.findMany({
    where: { leagueId: league.id },
    include: {
      agent: true,
    },
    orderBy: [{ rating: "desc" }, { updatedAt: "asc" }],
  });
  const rows = await Promise.all(
    ratings.map(async (r) => {
      const latest = await prisma.agentSubmission.findFirst({
        where: { leagueId: league.id, agentId: r.agentId },
        orderBy: { version: "desc" },
      });
      return {
        id: r.id,
        agentId: r.agentId,
        agentName: r.agent.name,
        mode: r.agent.mode,
        rating: r.rating,
        matches: r.matches,
        eligibility: r.agent.mode === "SANDBOX" && latest?.status === "RANKED_APPROVED" ? "ELIGIBLE" : "INELIGIBLE",
        latestSubmissionStatus: latest?.status ?? "NONE",
      };
    })
  );

  const matches = await prisma.rankedMatch.findMany({
    where: { leagueId: league.id },
    include: { agentA: true, agentB: true, winnerAgent: true },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return NextResponse.json({ leaderboard: rows, matches });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const member = await getMembership(league.id, user.id);
  if (!member || !hasAdminRole(member.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = RunRankedDuelSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.agentAId === parsed.data.agentBId) return NextResponse.json({ error: "Agents must be different" }, { status: 400 });

  const [agentA, agentB] = await Promise.all([
    prisma.agent.findFirst({ where: { id: parsed.data.agentAId, leagueId: league.id } }),
    prisma.agent.findFirst({ where: { id: parsed.data.agentBId, leagueId: league.id } }),
  ]);
  if (!agentA || !agentB) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  if (agentA.mode !== "SANDBOX" || agentB.mode !== "SANDBOX") {
    return NextResponse.json({ error: "Only SANDBOX agents can run ranked duels" }, { status: 400 });
  }

  const [subA, subB] = await Promise.all([
    latestApprovedSubmission(league.id, agentA.id),
    latestApprovedSubmission(league.id, agentB.id),
  ]);
  if (!subA || !subB) return NextResponse.json({ error: "Both agents need ranked-approved submissions" }, { status: 400 });
  if (!subA.artifacts[0] || !subB.artifacts[0]) return NextResponse.json({ error: "Submission artifacts missing" }, { status: 400 });

  const seed = parsed.data.seed ?? 42;
  const [runA, runB] = await Promise.all([
    runSubmissionCombine({
      leagueId: league.id,
      agentId: agentA.id,
      submissionId: subA.id,
      artifactPath: subA.artifacts[0].filePath,
      runType: "SCRIMMAGE",
      seed,
    }),
    runSubmissionCombine({
      leagueId: league.id,
      agentId: agentB.id,
      submissionId: subB.id,
      artifactPath: subB.artifacts[0].filePath,
      runType: "SCRIMMAGE",
      seed,
    }),
  ]);

  const scoreA = runA.scoreOverall + runA.scoreReliability - runA.scoreLatency * 0.1;
  const scoreB = runB.scoreOverall + runB.scoreReliability - runB.scoreLatency * 0.1;
  const winnerAgentId = scoreA === scoreB ? null : scoreA > scoreB ? agentA.id : agentB.id;
  const duelScoreA: 0 | 0.5 | 1 = scoreA === scoreB ? 0.5 : scoreA > scoreB ? 1 : 0;

  const [ratingA, ratingB] = await Promise.all([
    getOrCreateRating(league.id, agentA.id),
    getOrCreateRating(league.id, agentB.id),
  ]);
  const { newA, newB } = applyElo({ ratingA: ratingA.rating, ratingB: ratingB.rating, scoreA: duelScoreA });

  await prisma.$transaction([
    prisma.rankedRating.update({
      where: { id: ratingA.id },
      data: { rating: newA, matches: { increment: 1 } },
    }),
    prisma.rankedRating.update({
      where: { id: ratingB.id },
      data: { rating: newB, matches: { increment: 1 } },
    }),
    prisma.rankedMatch.create({
      data: {
        leagueId: league.id,
        agentAId: agentA.id,
        agentBId: agentB.id,
        submissionAId: subA.id,
        submissionBId: subB.id,
        matchType: "COMBINE_DUEL",
        seed,
        scoreA,
        scoreB,
        winnerAgentId: winnerAgentId ?? undefined,
      },
    }),
    prisma.eventLog.create({
      data: {
        leagueId: league.id,
        type: "RANKED_DUEL",
        visibility: "PUBLIC",
        summary: `${agentA.name} vs ${agentB.name} ranked duel ${winnerAgentId ? `won by ${winnerAgentId}` : "ended in draw"}`,
        entityType: "AGENT",
        entityId: winnerAgentId ?? undefined,
        meta: JSON.stringify({
          seed,
          agentAId: agentA.id,
          agentBId: agentB.id,
          scoreA,
          scoreB,
          winnerAgentId,
          ratings: { before: { a: ratingA.rating, b: ratingB.rating }, after: { a: newA, b: newB } },
        }),
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    winnerAgentId,
    scoreA,
    scoreB,
    ratings: { agentA: newA, agentB: newB },
    runs: { agentA: runA, agentB: runB },
  });
}
