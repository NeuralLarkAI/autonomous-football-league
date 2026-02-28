import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { AddTaskDependencySchema, RemoveTaskDependencySchema } from "@afl/core";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireActiveLeagueMember();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    const task = await prisma.task.findUnique({ where: { id }, select: { leagueId: true } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (task.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
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
    if (task.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (depTask.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const created = await prisma.taskDependency.upsert({
      where: { taskId_dependsOnTaskId: { taskId: id, dependsOnTaskId } },
      update: {},
      create: { leagueId: task.leagueId, taskId: id, dependsOnTaskId },
      include: { dependsOnTask: { select: { id: true, title: true, status: true } } },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: task.leagueId,
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
    const origin = enforceSameOrigin(req);
    if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: origin.status });
    const auth = await requireActiveLeagueMember({ admin: true });
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    const body = await req.json();
    const parsed = RemoveTaskDependencySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { dependsOnTaskId } = parsed.data;

    const existing = await prisma.taskDependency.findUnique({
      where: { taskId_dependsOnTaskId: { taskId: id, dependsOnTaskId } },
    });
    if (!existing) return NextResponse.json({ error: "Dependency not found" }, { status: 404 });
    const task = await prisma.task.findUnique({ where: { id }, select: { leagueId: true } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (task.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.taskDependency.delete({
      where: { taskId_dependsOnTaskId: { taskId: id, dependsOnTaskId } },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
