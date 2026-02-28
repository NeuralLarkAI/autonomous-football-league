import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { requireActiveLeagueMember } from "@/lib/internal-auth";

export async function GET(req: NextRequest) {
  const auth = await requireActiveLeagueMember();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { searchParams } = new URL(req.url);
  const take = Math.min(parseInt(searchParams.get("take") ?? searchParams.get("limit") ?? "100"), 300);
  const skip = Math.max(0, parseInt(searchParams.get("skip") ?? "0"));
  const agentId = searchParams.get("agentId") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const tierParam = searchParams.get("tier");
  const tier = tierParam ? Number(tierParam) : undefined;

  try {
    const events = await prisma.eventLog.findMany({
      where: {
        leagueId: auth.league.id,
        agentId,
        type,
        tier,
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { agent: { select: { id: true, name: true, department: true } } },
    });
    return NextResponse.json(events);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
