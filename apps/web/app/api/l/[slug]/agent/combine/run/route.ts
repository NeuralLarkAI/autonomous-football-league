import { NextRequest, NextResponse } from "next/server";
import { runCombine } from "@afl/agents";
import { prisma } from "@afl/db";
import { enforceScope } from "@/lib/api-key";
import { requireLeague } from "@/lib/league";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const league = await requireLeague(slug);
  const authz = await enforceScope({
    req,
    leagueId: league.id,
    requiredScope: "combine:run",
    denySummary: "Denied combine run for external agent",
  });
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  const agentId = authz.principal.agentId;
  if (!agentId) return NextResponse.json({ error: "Agent key required" }, { status: 403 });
  const agent = await prisma.agent.findFirst({ where: { id: agentId, leagueId: league.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const runType = body.runType === "SCRIMMAGE" ? "SCRIMMAGE" : "COMBINE";
  const seed = Number(body.seed ?? 42);
  const result = await runCombine(agent.id, runType, Number.isFinite(seed) ? seed : 42, league.id);
  return NextResponse.json(result);
}
