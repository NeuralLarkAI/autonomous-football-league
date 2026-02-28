import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { getActiveLeague } from "@/lib/request-league";
import { executeRunbookAction } from "@/lib/runbook-actions";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = enforceSameOrigin(req);
  if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
  const auth = await requireActiveLeagueMember({ admin: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const activeLeague = await getActiveLeague();
  const { id } = await params;
  const runbook = await prisma.runbook.findFirst({ where: { id, leagueId: activeLeague.id } });
  if (!runbook) return NextResponse.json({ error: "Runbook not found" }, { status: 404 });
  if (!runbook.isEnabled) return NextResponse.json({ error: "Runbook is disabled" }, { status: 409 });

  const runbookRun = await prisma.runbookRun.create({
    data: {
      leagueId: activeLeague.id,
      runbookId: runbook.id,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: activeLeague.id,
      agentId: runbook.ownerAgentId ?? undefined,
      type: "RUNBOOK_RUN_STARTED",
      summary: `Runbook started: ${runbook.name}`,
      entityType: "RUNBOOK",
      entityId: runbook.id,
      runbookId: runbook.id,
      runbookRunId: runbookRun.id,
      meta: JSON.stringify({ runbookRunId: runbookRun.id, actionType: runbook.actionType }),
    },
  });

  try {
    const outputSummary = await executeRunbookAction(
      {
        id: runbook.id,
        leagueId: runbook.leagueId,
        name: runbook.name,
        ownerAgentId: runbook.ownerAgentId,
        actionType: runbook.actionType,
        actionPayloadJson: runbook.actionPayloadJson,
      },
      runbookRun.id
    );

    const finished = await prisma.runbookRun.update({
      where: { id: runbookRun.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        outputSummary,
        errorText: null,
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: activeLeague.id,
        agentId: runbook.ownerAgentId ?? undefined,
        type: "RUNBOOK_RUN_COMPLETED",
        summary: `Runbook completed: ${runbook.name}`,
        entityType: "RUNBOOK",
        entityId: runbook.id,
        runbookId: runbook.id,
        runbookRunId: runbookRun.id,
        meta: JSON.stringify({ outputSummary }),
      },
    });

    return NextResponse.json(finished);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = await prisma.runbookRun.update({
      where: { id: runbookRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        outputSummary: message,
        errorText: message,
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: activeLeague.id,
        agentId: runbook.ownerAgentId ?? undefined,
        type: "RUNBOOK_RUN_FAILED",
        summary: `Runbook failed: ${runbook.name}`,
        entityType: "RUNBOOK",
        entityId: runbook.id,
        runbookId: runbook.id,
        runbookRunId: runbookRun.id,
        meta: JSON.stringify({ error: message }),
      },
    });

    return NextResponse.json(failed, { status: 500 });
  }
}
