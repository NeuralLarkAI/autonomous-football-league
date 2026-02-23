import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { RunCombineSchema } from "@afl/core";
import { runCombine } from "@afl/agents";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RunCombineSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { agentId, runType } = parsed.data;
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const result = await runCombine(agentId, runType);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Combine run failed" }, { status: 500 });
  }
}
