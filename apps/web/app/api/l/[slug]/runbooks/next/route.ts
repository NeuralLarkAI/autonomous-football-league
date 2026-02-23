import { NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getLeagueBySlug, getMembership } from "@/lib/league";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const membership = await getMembership(league.id, user.id);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const upcoming = await prisma.runbook.findMany({
    where: {
      leagueId: league.id,
      isEnabled: true,
      triggerType: "SCHEDULED",
    },
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
    take: 10,
    select: {
      id: true,
      name: true,
      actionType: true,
      nextRunAt: true,
      lastRunAt: true,
      failureCount: true,
      lockedAt: true,
      lockOwner: true,
      intervalSeconds: true,
      scheduleType: true,
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, startedAt: true, finishedAt: true, errorText: true },
      },
    },
  });

  return NextResponse.json(
    upcoming.map((r) => ({
      id: r.id,
      name: r.name,
      actionType: r.actionType,
      nextRunAt: r.nextRunAt,
      lastRunAt: r.lastRunAt,
      failureCount: r.failureCount,
      lockedAt: r.lockedAt,
      lockOwner: r.lockOwner,
      intervalSeconds: r.intervalSeconds,
      scheduleType: r.scheduleType,
      latestRun: r.runs[0] ?? null,
    }))
  );
}
