import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { RunAgentSchema } from "@afl/core";
import { runAgent } from "@afl/agents";

export async function GET() {
  try {
    const agents = await prisma.agent.findMany({ orderBy: { department: "asc" } });
    return NextResponse.json(agents);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RunAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { agentId } = parsed.data;

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const result = await runAgent(agentId);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Agent run failed" }, { status: 500 });
  }
}
