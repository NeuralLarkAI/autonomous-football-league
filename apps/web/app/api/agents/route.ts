import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { RunAgentSchema } from "@afl/core";
import { runAgent } from "@afl/agents";
import { requireActiveLeagueMember, enforceSameOrigin } from "@/lib/internal-auth";

export async function GET() {
  try {
    const auth = await requireActiveLeagueMember();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const agents = await prisma.agent.findMany({
      where: { leagueId: auth.league.id },
      orderBy: { department: "asc" },
    });
    return NextResponse.json(agents);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await req.json();
    const parsed = RunAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { agentId } = parsed.data;

    const agent = await prisma.agent.findFirst({ where: { id: agentId, leagueId: auth.league.id } });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const result = await runAgent(agentId);
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Agent run failed" }, { status: 500 });
  }
}
