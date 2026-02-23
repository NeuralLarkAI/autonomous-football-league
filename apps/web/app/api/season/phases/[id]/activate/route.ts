import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const phase = await prisma.seasonPhase.findUnique({ where: { id } });
    if (!phase) return NextResponse.json({ error: "Phase not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.seasonPhase.updateMany({
        where: { seasonNumber: phase.seasonNumber, status: "ACTIVE", id: { not: phase.id } },
        data: { status: "DONE" },
      });
      await tx.seasonPhase.update({ where: { id: phase.id }, data: { status: "ACTIVE" } });
      await tx.leagueState.update({
        where: { id: "singleton" },
        data: { phase: phase.name },
      });
      await tx.eventLog.create({
        data: {
          type: "SEASON_PHASE_ACTIVATED",
          summary: `Season phase activated: ${phase.name}`,
          entityType: "SEASON_PHASE",
          entityId: phase.id,
          seasonPhaseId: phase.id,
          meta: JSON.stringify({ seasonNumber: phase.seasonNumber }),
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to activate phase" }, { status: 500 });
  }
}
