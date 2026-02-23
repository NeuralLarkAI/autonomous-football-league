import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { RequestReviewSchema } from "@afl/core";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const approval = await prisma.approval.findUnique({ where: { id } });
    if (!approval || !approval.proposalId) {
      return NextResponse.json({ error: "Approval proposal not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = RequestReviewSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const reviewRequest = await prisma.reviewRequest.create({
      data: {
        proposalId: approval.proposalId,
        requesterAgentId: parsed.data.requesterAgentId,
        targetAgentId: parsed.data.targetAgentId,
        note: parsed.data.note ?? "",
      },
    });

    await prisma.eventLog.create({
      data: {
        agentId: parsed.data.requesterAgentId,
        type: "REVIEW_REQUESTED",
        tier: approval.tier,
        summary: `Review requested for approval ${id.slice(-6)}`,
        entityType: "APPROVAL",
        entityId: id,
        approvalId: id,
        proposalId: approval.proposalId,
        meta: JSON.stringify({
          approvalId: id,
          proposalId: approval.proposalId,
          requesterAgentId: parsed.data.requesterAgentId,
          targetAgentId: parsed.data.targetAgentId,
          note: parsed.data.note ?? "",
        }),
      },
    });

    return NextResponse.json(reviewRequest);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Request review failed" }, { status: 500 });
  }
}
