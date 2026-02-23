import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { enforceScope } from "@/lib/api-key";
import { requireLeague } from "@/lib/league";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const league = await requireLeague(slug);
  const authz = await enforceScope({
    req,
    leagueId: league.id,
    requiredScope: "feed:read",
    denySummary: "Denied feed read for external agent",
  });
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  const events = await prisma.eventLog.findMany({
    where: { leagueId: league.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(events);
}
