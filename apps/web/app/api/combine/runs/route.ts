import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const runType = searchParams.get("runType");
    const status = searchParams.get("status");

    const runs = await prisma.combineRun.findMany({
      where: {
        agentId: agentId ?? undefined,
        runType: runType ?? undefined,
        status: status ?? undefined,
      },
      include: {
        agent: { select: { id: true, name: true, department: true } },
        scenarioResults: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(runs);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to list combine runs" }, { status: 500 });
  }
}
