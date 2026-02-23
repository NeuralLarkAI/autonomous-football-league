import { NextResponse } from "next/server";
import { prisma } from "@afl/db";

export async function GET() {
  try {
    const [agentCount, taskCount, pendingApprovals, lastEvent, league] =
      await Promise.all([
        prisma.agent.count({ where: { status: "ACTIVE" } }),
        prisma.task.count({ where: { status: { in: ["BACKLOG", "IN_PROGRESS", "REVIEW", "BLOCKED"] } } }),
        prisma.approval.count({ where: { status: "PENDING" } }),
        prisma.eventLog.findFirst({ orderBy: { createdAt: "desc" } }),
        prisma.leagueState.findUnique({ where: { id: "singleton" } }),
      ]);

    return NextResponse.json({
      agentCount,
      openTaskCount: taskCount,
      pendingApprovals,
      lastEventAt: lastEvent?.createdAt ?? null,
      seasonLock: league?.seasonLock ?? false,
      season: league?.season ?? 0,
      phase: league?.phase ?? "PRE_SEASON",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
