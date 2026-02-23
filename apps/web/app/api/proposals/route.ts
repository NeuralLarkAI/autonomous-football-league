import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { CreateProposalSchema } from "@afl/core";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const tier = searchParams.get("tier");

    const proposals = await prisma.proposal.findMany({
      where: {
        status: status ?? undefined,
        tier: tier ? Number(tier) : undefined,
      },
      orderBy: { createdAt: "desc" },
      include: {
        creatorAgent: { select: { id: true, name: true, department: true } },
        signoffs: { include: { agent: { select: { id: true, name: true, department: true } } } },
        approvals: true,
      },
    });
    return NextResponse.json(proposals);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateProposalSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;

    const proposal = await prisma.proposal.create({
      data: {
        title: data.title,
        summary: data.summary,
        tier: data.tier,
        changeType: data.changeType,
        affectedArea: data.affectedArea,
        beforeJson: data.beforeJson ?? "{}",
        afterJson: data.afterJson ?? "{}",
        risk: data.risk ?? "",
        testPlan: data.testPlan ?? "",
        rollbackPlan: data.rollbackPlan ?? "",
        requiredSignoffs: JSON.stringify(data.requiredSignoffs),
        taskId: data.taskId,
        creatorAgentId: data.creatorAgentId,
      },
    });

    await prisma.approval.create({
      data: {
        proposalId: proposal.id,
        agentId: data.creatorAgentId ?? "commissioner",
        tier: data.tier,
        summary: data.summary,
        signoffs: JSON.stringify(data.requiredSignoffs),
      },
    });

    if (data.requiredSignoffs.length > 0) {
      await prisma.signoff.createMany({
        data: data.requiredSignoffs.map((agentId) => ({
          proposalId: proposal.id,
          agentId,
          status: "REQUESTED",
          comment: "Requested during proposal creation.",
        })),
      });
    }

    await prisma.eventLog.create({
      data: {
        agentId: data.creatorAgentId,
        type: "PROPOSAL_CREATED",
        tier: proposal.tier,
        summary: `Proposal created: ${proposal.title}`,
        entityType: "PROPOSAL",
        entityId: proposal.id,
        proposalId: proposal.id,
        meta: JSON.stringify({ proposalId: proposal.id, requiredSignoffs: data.requiredSignoffs }),
      },
    });

    return NextResponse.json(proposal);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
