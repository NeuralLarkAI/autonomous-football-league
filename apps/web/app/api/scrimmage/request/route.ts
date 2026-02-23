import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { ScrimmageRequestSchema } from "@afl/core";
import { runCombine } from "@afl/agents";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ScrimmageRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { agentAId, agentBId, seed } = parsed.data;
    if (agentAId === agentBId) return NextResponse.json({ error: "Agents must be different" }, { status: 400 });

    const [a, b] = await Promise.all([
      prisma.agent.findUnique({ where: { id: agentAId } }),
      prisma.agent.findUnique({ where: { id: agentBId } }),
    ]);
    if (!a || !b) return NextResponse.json({ error: "One or both agents not found" }, { status: 404 });

    const baseSeed = seed ?? 42;
    const [runA, runB] = await Promise.all([
      runCombine(agentAId, "SCRIMMAGE", baseSeed),
      runCombine(agentBId, "SCRIMMAGE", baseSeed),
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
