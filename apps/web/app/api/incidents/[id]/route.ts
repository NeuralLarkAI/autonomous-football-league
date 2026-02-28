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
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: { sourceAgent: { select: { id: true, name: true, department: true } } },
    });
    if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    if (incident.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(incident);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
}
