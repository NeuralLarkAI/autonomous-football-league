import { NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { requireActiveLeagueMember } from "@/lib/internal-auth";

export async function GET() {
  try {
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [runs24h, created7d, completed7d, pendingApprovalsByTier, openIncidents] = await Promise.all([
      prisma.agentRun.findMany({ where: { leagueId: auth.league.id, startedAt: { gte: dayAgo } } }),
      prisma.task.count({ where: { leagueId: auth.league.id, createdAt: { gte: weekAgo } } }),
      prisma.task.count({ where: { leagueId: auth.league.id, status: "DONE", updatedAt: { gte: weekAgo } } }),
      prisma.approval.groupBy({
        by: ["tier"],
        where: { leagueId: auth.league.id, status: "PENDING" },
        _count: { _all: true },
      }),
      prisma.incident.count({ where: { leagueId: auth.league.id, status: { not: "RESOLVED" } } }),
    ]);

    const totalRuns = runs24h.length;
    const failedRuns = runs24h.filter((r) => r.status === "FAILED").length;
    const errorRate = totalRuns === 0 ? 0 : failedRuns / totalRuns;
    const avgDurationMs =
      totalRuns === 0 ? 0 : Math.round(runs24h.reduce((sum, run) => sum + run.durationMs, 0) / totalRuns);

    const approvalBacklogByTier: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0 };
    for (const row of pendingApprovalsByTier) approvalBacklogByTier[String(row.tier)] = row._count._all;

    return NextResponse.json({
      runErrorRate24h: errorRate,
      avgRunDurationMs24h: avgDurationMs,
      taskThroughput7d: { created: created7d, completed: completed7d },
      approvalBacklogByTier,
      openIncidents,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Health calculation failed" }, { status: 500 });
  }
}
