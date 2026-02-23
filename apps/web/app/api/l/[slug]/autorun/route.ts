import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getLeagueBySlug, getMembership, hasAdminRole } from "@/lib/league";
import { getSessionUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  const membership = await getMembership(league.id, user.id);
  if (!membership || !hasAdminRole(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const enabled = Boolean(body.enabled);

  await prisma.leagueState.upsert({
    where: { leagueId: league.id },
    update: { autoRunEnabled: enabled },
    create: {
      leagueId: league.id,
      season: 0,
      seasonLock: false,
      autoRunEnabled: enabled,
      phase: "PRE_SEASON",
    },
  });

  if (enabled) {
    const scheduled = await prisma.runbook.findMany({
      where: {
        leagueId: league.id,
        triggerType: "SCHEDULED",
        isEnabled: true,
        nextRunAt: null,
      },
    });
    for (const runbook of scheduled) {
      const nextRunAt =
        runbook.scheduleType === "INTERVAL" && runbook.intervalSeconds
          ? new Date(Date.now() + runbook.intervalSeconds * 1000)
          : new Date(Date.now() + 60 * 1000);
      await prisma.runbook.update({
        where: { id: runbook.id },
        data: { nextRunAt, failureCount: 0, lockedAt: null, lockOwner: null },
      });
    }
  }

  await prisma.eventLog.create({
    data: {
      leagueId: league.id,
      type: enabled ? "AUTORUN_ENABLED" : "AUTORUN_DISABLED",
      summary: enabled ? "Auto-run enabled for league." : "Auto-run disabled for league.",
      entityType: "LEAGUE",
      entityId: league.id,
      meta: JSON.stringify({ enabled, userId: user.id }),
    },
  });

  return NextResponse.json({ ok: true, enabled });
}
