import { NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getActiveLeague } from "@/lib/request-league";

export async function GET() {
  try {
    const activeLeague = await getActiveLeague();
    const [agentCount, taskCount, pendingApprovals, lastEvent, leagueState, activePhase, nextRunbooks] =
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
      ]);

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
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
