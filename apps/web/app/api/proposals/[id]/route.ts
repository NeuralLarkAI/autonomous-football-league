import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { PatchProposalSchema } from "@afl/core";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        creatorAgent: { select: { id: true, name: true, department: true } },
        signoffs: { include: { agent: { select: { id: true, name: true, department: true } } } },
        reviewRequests: {
          include: {
            requesterAgent: { select: { id: true, name: true } },
            targetAgent: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        approvals: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    return NextResponse.json(proposal);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = PatchProposalSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const updateData = {
      ...parsed.data,
      requiredSignoffs: parsed.data.requiredSignoffs
        ? JSON.stringify(parsed.data.requiredSignoffs)
        : undefined,
    };

    const proposal = await prisma.proposal.update({
      where: { id },
      data: updateData,
    });

    await prisma.eventLog.create({
      data: {
        type: "PROPOSAL_UPDATED",
        tier: proposal.tier,
        summary: `Proposal updated: ${proposal.title}`,
        entityType: "PROPOSAL",
        entityId: proposal.id,
        proposalId: proposal.id,
        meta: JSON.stringify({ proposalId: proposal.id, fields: Object.keys(parsed.data) }),
      },
    });

    return NextResponse.json(proposal);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
