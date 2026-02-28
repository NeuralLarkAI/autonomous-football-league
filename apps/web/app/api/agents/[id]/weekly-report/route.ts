import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        tasks: { where: { status: { not: "DONE" } } },
        runs: { orderBy: { startedAt: "desc" }, take: 7 },
      },
    });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    if (agent.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const completedRuns = agent.runs.filter((r) => r.status === "SUCCESS").length;
    const avgDurationMs =
      agent.runs.length === 0
        ? 0
        : Math.round(agent.runs.reduce((sum, r) => sum + r.durationMs, 0) / agent.runs.length);

    const reportTitle = `${agent.name} Weekly Report`;
    const reportBody = [
      `Agent: ${agent.name}`,
      `Department: ${agent.department}`,
      `Open Tasks: ${agent.tasks.length}`,
      `Runs (last 7): ${agent.runs.length}`,
      `Successful Runs: ${completedRuns}`,
      `Avg Duration (ms): ${avgDurationMs}`,
      `Generated At: ${new Date().toISOString()}`,
    ].join("\n");

    const message = await prisma.message.create({
      data: {
        leagueId: agent.leagueId,
        agentId: agent.id,
        type: "REPORT",
        title: reportTitle,
        body: reportBody,
        meta: JSON.stringify({ openTasks: agent.tasks.length, runs: agent.runs.length, avgDurationMs }),
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: agent.leagueId,
        agentId: agent.id,
        type: "AGENT_WEEKLY_REPORT",
        summary: `${agent.name} generated weekly report.`,
        entityType: "AGENT",
        entityId: agent.id,
        meta: JSON.stringify({ messageId: message.id }),
      },
    });

    return NextResponse.json({ ok: true, message });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Weekly report failed" }, { status: 500 });
  }
}
