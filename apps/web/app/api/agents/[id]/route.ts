import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        tasks: {
          where: { status: { in: ["BACKLOG", "IN_PROGRESS", "REVIEW", "BLOCKED"] } },
          orderBy: { updatedAt: "desc" },
          take: 25,
        },
        events: { orderBy: { createdAt: "desc" }, take: 25 },
        runs: { orderBy: { startedAt: "desc" }, take: 50 },
      },
    });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const lastRun = agent.runs[0] ?? null;
    const parsedScopes = (() => {
      try {
        return JSON.parse(agent.permissionScopes);
      } catch {
        return [];
      }
    })();
    const parsedKpis = (() => {
      try {
        return JSON.parse(agent.kpis);
      } catch {
        return {};
      }
    })();

    return NextResponse.json({
      ...agent,
      permissionScopesParsed: parsedScopes,
      kpisParsed: parsedKpis,
      lastRun,
      runHistory: agent.runs,
      openTasks: agent.tasks,
      lastEvents: agent.events,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
}
