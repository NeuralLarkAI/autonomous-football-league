import { NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { requireActiveLeagueMember } from "@/lib/internal-auth";

export async function GET() {
  try {
    const auth = await requireActiveLeagueMember();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const tasks = await prisma.task.findMany({
      where: { leagueId: auth.league.id },
      orderBy: { createdAt: "desc" },
      include: {
        assignee: { select: { id: true, name: true, department: true } },
        _count: { select: { dependencies: true, blockedBy: true } },
      },
    });
    return NextResponse.json(tasks);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
