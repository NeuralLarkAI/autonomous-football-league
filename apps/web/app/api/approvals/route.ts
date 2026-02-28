import { NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { requireActiveLeagueMember } from "@/lib/internal-auth";

export async function GET() {
  try {
    const auth = await requireActiveLeagueMember();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const approvals = await prisma.approval.findMany({
      where: { leagueId: auth.league.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        agent: { select: { id: true, name: true, department: true } },
        task: { select: { id: true, title: true } },
        proposal: { select: { id: true, title: true, tier: true, status: true } },
      },
    });
    return NextResponse.json(approvals);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
