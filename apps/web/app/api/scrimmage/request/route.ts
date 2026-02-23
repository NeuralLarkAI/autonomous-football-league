import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { ScrimmageRequestSchema } from "@afl/core";
import { runCombine } from "@afl/agents";
import { getActiveLeague } from "@/lib/request-league";

export async function POST(req: NextRequest) {
  try {
    const activeLeague = await getActiveLeague();
    const body = await req.json();
    const parsed = ScrimmageRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { agentAId, agentBId, seed } = parsed.data;
    if (agentAId === agentBId) return NextResponse.json({ error: "Agents must be different" }, { status: 400 });

    const [a, b] = await Promise.all([
      prisma.agent.findFirst({ where: { id: agentAId, leagueId: activeLeague.id } }),
      prisma.agent.findFirst({ where: { id: agentBId, leagueId: activeLeague.id } }),
    ]);
    if (!a || !b) return NextResponse.json({ error: "One or both agents not found" }, { status: 404 });

    const baseSeed = seed ?? 42;
    const [runA, runB] = await Promise.all([
      runCombine(agentAId, "SCRIMMAGE", baseSeed, activeLeague.id),
      runCombine(agentBId, "SCRIMMAGE", baseSeed, activeLeague.id),
    ]);

    const comparison = {
      agentA: { id: agentAId, scoreOverall: runA.scoreOverall, scoreReliability: runA.scoreReliability },
      agentB: { id: agentBId, scoreOverall: runB.scoreOverall, scoreReliability: runB.scoreReliability },
      winner:
        runA.scoreOverall === runB.scoreOverall
          ? "TIE"
          : runA.scoreOverall > runB.scoreOverall
            ? agentAId
            : agentBId,
    };

    return NextResponse.json({ runA, runB, comparison });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Scrimmage request failed" }, { status: 500 });
  }
}
