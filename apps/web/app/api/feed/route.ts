import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

  try {
    const events = await prisma.eventLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { agent: { select: { id: true, name: true, department: true } } },
    });
    return NextResponse.json(events);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
