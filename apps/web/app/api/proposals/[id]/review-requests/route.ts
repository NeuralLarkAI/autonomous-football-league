import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { RequestReviewSchema } from "@afl/core";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requests = await prisma.reviewRequest.findMany({
      where: { proposalId: id },
      include: {
        requesterAgent: { select: { id: true, name: true, department: true } },
        targetAgent: { select: { id: true, name: true, department: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(requests);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = RequestReviewSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const reviewRequest = await prisma.reviewRequest.create({
      data: {
        proposalId: id,
        requesterAgentId: parsed.data.requesterAgentId,
        targetAgentId: parsed.data.targetAgentId,
        note: parsed.data.note ?? "",
      },
      include: {
        requesterAgent: { select: { id: true, name: true } },
        targetAgent: { select: { id: true, name: true } },
      },
    });

    await prisma.eventLog.create({
      data: {
        agentId: parsed.data.requesterAgentId,
        type: "REVIEW_REQUESTED",
        summary: `Review requested for proposal ${id.slice(-6)}`,
        entityType: "PROPOSAL",
        entityId: id,
        proposalId: id,
        meta: JSON.stringify({
          proposalId: id,
          requesterAgentId: parsed.data.requesterAgentId,
          targetAgentId: parsed.data.targetAgentId,
          note: parsed.data.note ?? "",
        }),
      },
    });

    return NextResponse.json(reviewRequest);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
