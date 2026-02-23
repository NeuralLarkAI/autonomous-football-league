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
      data: { status: "APPROVED" },
      include: { agent: true },
    });

    await prisma.eventLog.create({
      data: {
        agentId: approval.agentId,
        type: "APPROVED",
        summary: `Approval #${id.slice(-6)} APPROVED - ${approval.summary}`,
        meta: JSON.stringify({ approvalId: id, tier: approval.tier }),
      },
    });

    return NextResponse.json(approval);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Approve failed" }, { status: 500 });
  }
}
