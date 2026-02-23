import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { RejectSchema } from "@afl/core";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = RejectSchema.safeParse(body);
    const reason = parsed.success ? (parsed.data.reason ?? "No reason given") : "No reason given";

    const approval = await prisma.approval.update({
      where: { id },
      data: { status: "REJECTED" },
      include: { agent: true },
    });

    await prisma.eventLog.create({
      data: {
        agentId: approval.agentId,
        type: "REJECTED",
        summary: `Approval #${id.slice(-6)} REJECTED — ${approval.summary}. Reason: ${reason}`,
        meta: JSON.stringify({ approvalId: id, tier: approval.tier, reason }),
      },
    });

    return NextResponse.json(approval);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Reject failed" }, { status: 500 });
  }
}
