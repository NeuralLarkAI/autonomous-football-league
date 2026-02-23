import { NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getActiveLeague } from "@/lib/request-league";

export async function GET() {
  try {
    const activeLeague = await getActiveLeague();
    const [agentCount, taskCount, pendingApprovals, lastEvent, leagueState, activePhase, nextRunbooks, seasonOne, seasonZeroProgress] =
      await Promise.all([
        prisma.agent.count({ where: { leagueId: activeLeague.id, status: "ACTIVE" } }),
        prisma.task.count({ where: { leagueId: activeLeague.id, status: { in: ["BACKLOG", "IN_PROGRESS", "REVIEW", "BLOCKED"] } } }),
        prisma.approval.count({ where: { leagueId: activeLeague.id, status: "PENDING" } }),
        prisma.eventLog.findFirst({ where: { leagueId: activeLeague.id }, orderBy: { createdAt: "desc" } }),
        prisma.leagueState.findUnique({ where: { leagueId: activeLeague.id } }),
        prisma.seasonPhase.findFirst({ where: { leagueId: activeLeague.id, status: "ACTIVE" }, orderBy: { startDate: "asc" } }),
        prisma.runbook.findMany({
          where: { leagueId: activeLeague.id, isEnabled: true },
          orderBy: { createdAt: "desc" },
          take: 3,
          include: { ownerAgent: { select: { id: true, name: true } } },
        }),
        prisma.season.findFirst({
          where: { leagueId: activeLeague.id, seasonNumber: 1 },
          orderBy: { createdAt: "desc" },
        }),
        Promise.all([
          prisma.task.count({ where: { leagueId: activeLeague.id } }),
          prisma.proposal.count({ where: { leagueId: activeLeague.id, status: "PENDING" } }),
          prisma.approval.count({ where: { leagueId: activeLeague.id, status: "PENDING", tier: { gte: 2 } } }),
          prisma.incident.count({ where: { leagueId: activeLeague.id, status: { not: "RESOLVED" } } }),
          prisma.post.count({ where: { leagueId: activeLeague.id } }),
          prisma.combineRun.count({ where: { leagueId: activeLeague.id } }),
        ]),
      ]);

    const [teamCount, gameCount, weekOneFinal, weekOneTotal] = seasonOne
      ? await Promise.all([
          prisma.team.count({ where: { leagueId: activeLeague.id } }),
          prisma.game.count({ where: { leagueId: activeLeague.id, seasonId: seasonOne.id } }),
          prisma.game.count({ where: { leagueId: activeLeague.id, seasonId: seasonOne.id, week: 1, status: "FINAL" } }),
          prisma.game.count({ where: { leagueId: activeLeague.id, seasonId: seasonOne.id, week: 1 } }),
        ])
      : [0, 0, 0, 0];

    return NextResponse.json({
      agentCount,
      openTaskCount: taskCount,
      pendingApprovals,
      lastEventAt: lastEvent?.createdAt ?? null,
      seasonLock: leagueState?.seasonLock ?? false,
      season: leagueState?.season ?? 0,
      phase: leagueState?.phase ?? "PRE_SEASON",
      activePhase,
      nextRunbooks,
      seasonZero: {
        tasksTotal: seasonZeroProgress[0],
        proposalsPending: seasonZeroProgress[1],
        approvalsPendingTier23: seasonZeroProgress[2],
        incidentsOpen: seasonZeroProgress[3],
        postsCount: seasonZeroProgress[4],
        combineRunsCount: seasonZeroProgress[5],
      },
      seasonOne: seasonOne
        ? {
            id: seasonOne.id,
            status: seasonOne.status,
            teamCount,
            gameCount,
            weekOneFinal,
            weekOneTotal,
          }
        : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
