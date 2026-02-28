import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { PatchRunbookSchema } from "@afl/core";
import { getActiveLeague } from "@/lib/request-league";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const league = await getActiveLeague();
    const { id } = await params;
    const body = await req.json();
    const parsed = PatchRunbookSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const existing = await prisma.runbook.findFirst({ where: { id, leagueId: league.id } });
    if (!existing) return NextResponse.json({ error: "Runbook not found" }, { status: 404 });

    const triggerType = parsed.data.triggerType ?? existing.triggerType;
    const scheduleType = parsed.data.scheduleType ?? existing.scheduleType;
    const intervalSeconds = parsed.data.intervalSeconds ?? existing.intervalSeconds;
    const enabling = parsed.data.isEnabled === true;

    const data = {
      ...parsed.data,
      nextRunAt:
        parsed.data.nextRunAt === undefined
          ? undefined
          : parsed.data.nextRunAt === null
            ? null
            : new Date(parsed.data.nextRunAt),
    };

    if (
      data.nextRunAt === undefined &&
      triggerType === "SCHEDULED" &&
      scheduleType === "INTERVAL" &&
      intervalSeconds &&
      (enabling || existing.nextRunAt === null)
    ) {
      data.nextRunAt = new Date(Date.now() + intervalSeconds * 1000);
    }

    const runbook = await prisma.runbook.update({
      where: { id },
      data,
    });

    await prisma.eventLog.create({
      data: {
        leagueId: league.id,
        agentId: runbook.ownerAgentId ?? undefined,
        type: "RUNBOOK_UPDATED",
        summary: `Runbook updated: ${runbook.name}`,
        entityType: "RUNBOOK",
        entityId: runbook.id,
        runbookId: runbook.id,
        meta: JSON.stringify(data),
      },
    });

    return NextResponse.json(runbook);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update runbook" }, { status: 500 });
  }
}
