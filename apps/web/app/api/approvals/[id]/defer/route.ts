import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    const existing = await prisma.approval.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    if (existing.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Approval is not pending" }, { status: 409 });
    }

    const approval = await prisma.approval.update({
      where: { id },
      data: { status: "DEFERRED" },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: existing.leagueId,
        agentId: approval.agentId,
        type: "DEFERRED",
        tier: approval.tier,
        summary: `Approval #${id.slice(-6)} DEFERRED to offseason - ${approval.summary}`,
        entityType: "APPROVAL",
        entityId: id,
        approvalId: id,
        proposalId: approval.proposalId ?? undefined,
        meta: JSON.stringify({ approvalId: id, tier: approval.tier }),
      },
    });

    return NextResponse.json(approval);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Defer failed" }, { status: 500 });
  }
}
