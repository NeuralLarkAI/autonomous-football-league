import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { RunCombineSchema } from "@afl/core";
import { runCombine } from "@afl/agents";
import { getActiveLeague } from "@/lib/request-league";

export async function POST(req: NextRequest) {
  try {
    const activeLeague = await getActiveLeague();
    const body = await req.json();
    const parsed = RunCombineSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { agentId, runType } = parsed.data;
    const seed = Number(body.seed ?? 42);
    const agent = await prisma.agent.findFirst({ where: { id: agentId, leagueId: activeLeague.id } });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const result = await runCombine(agentId, runType, Number.isFinite(seed) ? seed : 42, activeLeague.id);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Combine run failed" }, { status: 500 });
  }
}
