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
    const run = await prisma.combineRun.findUnique({
      where: { id },
      include: {
        agent: { select: { id: true, name: true, department: true } },
        scenarioResults: { orderBy: { createdAt: "asc" } },
      },
    });
    if (run && run.leagueId !== auth.league.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!run) return NextResponse.json({ error: "Combine run not found" }, { status: 404 });
    return NextResponse.json(run);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to read combine run" }, { status: 500 });
  }
}
