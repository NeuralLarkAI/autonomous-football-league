import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { PatchRunbookSchema } from "@afl/core";
import { getActiveLeague } from "@/lib/request-league";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const league = await getActiveLeague();
    const { id } = await params;
    const body = await req.json();
    const parsed = PatchRunbookSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const existing = await prisma.runbook.findFirst({ where: { id, leagueId: league.id } });
    if (!existing) return NextResponse.json({ error: "Runbook not found" }, { status: 404 });

    const runbook = await prisma.runbook.update({
      where: { id },
      data: parsed.data,
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
        meta: JSON.stringify(parsed.data),
      },
    });

    return NextResponse.json(runbook);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update runbook" }, { status: 500 });
  }
}
