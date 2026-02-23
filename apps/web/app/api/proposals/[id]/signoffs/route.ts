import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { SetSignoffSchema } from "@afl/core";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const signoffs = await prisma.signoff.findMany({
      where: { proposalId: id },
      include: { agent: { select: { id: true, name: true, department: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(signoffs);
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
    const parsed = SetSignoffSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { agentId, status, comment } = parsed.data;

    const signoff = await prisma.signoff.upsert({
      where: { proposalId_agentId: { proposalId: id, agentId } },
      update: { status, comment: comment ?? "" },
      create: { proposalId: id, agentId, status, comment: comment ?? "" },
      include: { agent: { select: { id: true, name: true, department: true } } },
    });

    await prisma.eventLog.create({
      data: {
        agentId,
        type:
          status === "REQUESTED"
            ? "SIGNOFF_REQUESTED"
            : status === "APPROVED"
              ? "SIGNOFF_APPROVED"
              : "SIGNOFF_CHANGES_REQUESTED",
        summary: `Signoff ${status} by ${signoff.agent.name} for proposal ${id.slice(-6)}`,
        entityType: "PROPOSAL",
        entityId: id,
        proposalId: id,
        meta: JSON.stringify({ proposalId: id, agentId, status, comment: comment ?? "" }),
      },
    });

    return NextResponse.json(signoff);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }
}
