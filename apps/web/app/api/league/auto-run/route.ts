import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getActiveLeague } from "@/lib/request-league";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

/**
 * PATCH /api/league/auto-run
 * Body: { enabled: boolean }
 *
 * Toggles autoRunEnabled on the league state, which controls whether the
 * background worker picks up and executes scheduled runbooks.
 * Also initializes nextRunAt for any scheduled runbooks that have never run.
 */
export async function PATCH(req: NextRequest) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const activeLeague = await getActiveLeague();
    const body = (await req.json()) as { enabled?: unknown };

    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "Body must include { enabled: boolean }" }, { status: 400 });
    }

    const leagueState = await prisma.leagueState.update({
      where: { leagueId: activeLeague.id },
      data: { autoRunEnabled: body.enabled },
    });

    // When enabling, make sure all scheduled runbooks have a nextRunAt so the
    // worker can pick them up immediately.
    if (body.enabled) {
      await prisma.runbook.updateMany({
        where: {
          leagueId: activeLeague.id,
          triggerType: "SCHEDULED",
          isEnabled: true,
          nextRunAt: null,
        },
        data: { nextRunAt: new Date() },
      });
    }

    await prisma.eventLog.create({
      data: {
        leagueId: activeLeague.id,
        type: body.enabled ? "RUNBOOK_STARTED" : "RUNBOOK_COMPLETED",
        summary: body.enabled
          ? "Auto-run enabled: background worker will now execute scheduled runbooks."
          : "Auto-run disabled: background worker paused.",
        meta: JSON.stringify({ autoRunEnabled: body.enabled }),
      },
    });

    return NextResponse.json({ autoRunEnabled: leagueState.autoRunEnabled });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

/**
 * GET /api/league/auto-run
 * Returns current autoRunEnabled state and count of active scheduled runbooks.
 */
export async function GET() {
  try {
    const auth = await requireActiveLeagueMember();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const activeLeague = await getActiveLeague();

    const [leagueState, scheduledCount, pendingCount] = await Promise.all([
      prisma.leagueState.findUnique({ where: { leagueId: activeLeague.id } }),
      prisma.runbook.count({
        where: { leagueId: activeLeague.id, triggerType: "SCHEDULED", isEnabled: true },
      }),
      prisma.runbook.count({
        where: {
          leagueId: activeLeague.id,
          triggerType: "SCHEDULED",
          isEnabled: true,
          nextRunAt: { lte: new Date() },
        },
      }),
    ]);

    return NextResponse.json({
      autoRunEnabled: leagueState?.autoRunEnabled ?? false,
      scheduledRunbooks: scheduledCount,
      overdueRunbooks: pendingCount,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
