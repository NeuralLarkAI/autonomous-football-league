import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { requireActiveLeagueMember } from "@/lib/internal-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireActiveLeagueMember();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        agent: { select: { id: true, name: true, department: true } },
        task: { select: { id: true, title: true, tier: true, status: true } },
        proposal: {
          include: {
            signoffs: { include: { agent: { select: { id: true, name: true, department: true } } } },
            reviewRequests: {
              include: {
                requesterAgent: { select: { id: true, name: true } },
                targetAgent: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });
    if (!approval) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    if (approval.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(approval);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
}
