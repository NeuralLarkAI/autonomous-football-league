import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";

function requiredByTier(tier: number): string[] {
  if (tier >= 3) return ["commissioner", "integrity", "security"];
  if (tier >= 2) return ["commissioner", "integrity"];
  return ["commissioner"];
}

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

    const league = await prisma.leagueState.findUnique({ where: { id: "singleton" } });
    if (league?.seasonLock && existing.tier >= 2) {
      return NextResponse.json(
        { error: "Season lock active. Tier 2/3 approvals must be deferred to offseason." },
        { status: 409 }
      );
    }

    const enforceSignoffs = process.env.AFL_ENFORCE_SIGNOFFS === "1";
    if (existing.proposalId && existing.tier >= 2 && enforceSignoffs) {
      const signoffs = await prisma.signoff.findMany({ where: { proposalId: existing.proposalId } });
      const approved = new Set(signoffs.filter((s) => s.status === "APPROVED").map((s) => s.agentId));
      const required = requiredByTier(existing.tier);
      const missing = required.filter((id) => !approved.has(id));
      if (missing.length > 0) {
        return NextResponse.json(
          { error: "Required signoffs missing", missingSignoffs: missing },
          { status: 409 }
        );
      }
    }

    if (existing.proposalId && existing.tier >= 2 && !enforceSignoffs) {
      await prisma.signoff.upsert({
        where: { proposalId_agentId: { proposalId: existing.proposalId, agentId: "commissioner" } },
        update: {
          status: "APPROVED",
          comment: "Commissioner override approval executed from Approvals queue.",
        },
        create: {
          leagueId: existing.leagueId,
          proposalId: existing.proposalId,
          agentId: "commissioner",
          status: "APPROVED",
          comment: "Commissioner override approval executed from Approvals queue.",
        },
      });
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
        tier: approval.tier,
        summary: `Approval #${id.slice(-6)} APPROVED - ${approval.summary}`,
        entityType: "APPROVAL",
        entityId: id,
        approvalId: id,
        proposalId: approval.proposalId ?? undefined,
        meta: JSON.stringify({ approvalId: id, tier: approval.tier, signoffPolicy: enforceSignoffs ? "strict" : "commissioner_override" }),
      },
    });

    return NextResponse.json(approval);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Approve failed" }, { status: 500 });
  }
}
