import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { CreateRunbookSchema } from "@afl/core";
import { getActiveLeague } from "@/lib/request-league";

export async function GET() {
  try {
    const league = await getActiveLeague();
    const runbooks = await prisma.runbook.findMany({
      where: { leagueId: league.id },
      include: {
        ownerAgent: { select: { id: true, name: true, department: true } },
        runs: { orderBy: { createdAt: "desc" }, take: 10 },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(runbooks);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to list runbooks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const league = await getActiveLeague();
    const body = await req.json();
    const parsed = CreateRunbookSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const runbook = await prisma.runbook.create({
      data: {
        leagueId: league.id,
        name: parsed.data.name,
        description: parsed.data.description,
        ownerAgentId: parsed.data.ownerAgentId ?? null,
        triggerType: parsed.data.triggerType,
        scheduleType: parsed.data.scheduleType,
        intervalSeconds: parsed.data.intervalSeconds ?? null,
        cron: parsed.data.cron ?? null,
        actionType: parsed.data.actionType,
        actionPayloadJson: parsed.data.actionPayloadJson ?? "{}",
        isEnabled: parsed.data.isEnabled,
        nextRunAt:
          parsed.data.triggerType === "SCHEDULED" && parsed.data.scheduleType === "INTERVAL" && parsed.data.intervalSeconds
            ? new Date(Date.now() + parsed.data.intervalSeconds * 1000)
            : null,
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: league.id,
        agentId: parsed.data.ownerAgentId ?? undefined,
        type: "RUNBOOK_CREATED",
        summary: `Runbook created: ${runbook.name}`,
        entityType: "RUNBOOK",
        entityId: runbook.id,
        runbookId: runbook.id,
        meta: JSON.stringify({ actionType: runbook.actionType, triggerType: runbook.triggerType }),
      },
    });

    return NextResponse.json(runbook);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create runbook" }, { status: 500 });
  }
}
