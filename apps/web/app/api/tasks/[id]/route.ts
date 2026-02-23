import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { PatchTaskSchema } from "@afl/core";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = PatchTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const task = await prisma.task.update({
      where: { id },
      data: parsed.data,
    });

    await prisma.eventLog.create({
      data: {
        type: "TASK_CREATED",
        summary: `Task "${task.title}" status updated to ${task.status}`,
        meta: JSON.stringify({ taskId: id, ...parsed.data }),
      },
    });

    return NextResponse.json(task);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
