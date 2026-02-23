import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.approval.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Approval is not pending" }, { status: 409 });
    }

    const approval = await prisma.approval.update({
      where: { id },
      data: { status: "DEFERRED" },
    });

    await prisma.eventLog.create({
      data: {
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
