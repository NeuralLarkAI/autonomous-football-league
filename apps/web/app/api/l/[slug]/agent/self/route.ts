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
    requiredScope: "agent:self:read",
    denySummary: "Denied agent self read",
  });
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  if (!authz.principal.agentId) return NextResponse.json({ error: "Agent key required" }, { status: 403 });
  const agent = await prisma.agent.findFirst({
    where: { id: authz.principal.agentId, leagueId: league.id },
    include: { apiKeys: { include: { scopes: true } } },
  });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json(agent);
}
