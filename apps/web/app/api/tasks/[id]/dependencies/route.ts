import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { AddTaskDependencySchema, RemoveTaskDependencySchema } from "@afl/core";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dependencies = await prisma.taskDependency.findMany({
      where: { taskId: id },
      include: {
        dependsOnTask: { select: { id: true, title: true, status: true, tier: true } },
      },
      orderBy: { dependsOnTask: { createdAt: "desc" } },
    });
    return NextResponse.json(dependencies);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = AddTaskDependencySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { dependsOnTaskId } = parsed.data;

    if (id === dependsOnTaskId) {
      return NextResponse.json({ error: "Task cannot depend on itself" }, { status: 400 });
    }

    const [task, depTask] = await Promise.all([
      prisma.task.findUnique({ where: { id } }),
      prisma.task.findUnique({ where: { id: dependsOnTaskId } }),
    ]);
    if (!task || !depTask) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const created = await prisma.taskDependency.upsert({
      where: { taskId_dependsOnTaskId: { taskId: id, dependsOnTaskId } },
      update: {},
      create: { taskId: id, dependsOnTaskId },
      include: { dependsOnTask: { select: { id: true, title: true, status: true } } },
    });

    await prisma.eventLog.create({
      data: {
        type: "TASK_UPDATED",
        tier: task.tier,
        summary: `Dependency added: "${task.title}" depends on "${depTask.title}"`,
        entityType: "TASK",
        entityId: id,
        taskId: id,
        meta: JSON.stringify({ taskId: id, dependsOnTaskId }),
      },
    });

    return NextResponse.json(created);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = RemoveTaskDependencySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { dependsOnTaskId } = parsed.data;

    const existing = await prisma.taskDependency.findUnique({
      where: { taskId_dependsOnTaskId: { taskId: id, dependsOnTaskId } },
    });
    if (!existing) return NextResponse.json({ error: "Dependency not found" }, { status: 404 });

    await prisma.taskDependency.delete({
      where: { taskId_dependsOnTaskId: { taskId: id, dependsOnTaskId } },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
