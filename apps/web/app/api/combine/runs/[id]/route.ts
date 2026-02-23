import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const run = await prisma.combineRun.findUnique({
      where: { id },
      include: {
        agent: { select: { id: true, name: true, department: true } },
        scenarioResults: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!run) return NextResponse.json({ error: "Combine run not found" }, { status: 404 });
    return NextResponse.json(run);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to read combine run" }, { status: 500 });
  }
}
