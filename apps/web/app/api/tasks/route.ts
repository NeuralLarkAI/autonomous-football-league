import { NextResponse } from "next/server";
import { prisma } from "@afl/db";

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assignee: { select: { id: true, name: true, department: true } },
        _count: { select: { dependencies: true, blockedBy: true } },
      },
    });
    return NextResponse.json(tasks);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
