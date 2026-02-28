import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@afl/db";
import { PatchTaskSchema } from "@afl/core";
import { enforceSameOrigin, requireActiveLeagueMember } from "@/lib/internal-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireActiveLeagueMember();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, department: true } },
        approvals: { orderBy: { createdAt: "desc" } },
        dependencies: {
          include: {
            dependsOnTask: { select: { id: true, title: true, status: true, tier: true } },
          },
        },
        blockedBy: {
          include: {
            task: { select: { id: true, title: true, status: true, tier: true } },
          },
        },
      },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (task.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(task);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
}

export async function PATCH(
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
    const parsed = PatchTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existingTask = await prisma.task.findUnique({ where: { id } });
    if (!existingTask) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (existingTask.leagueId !== auth.league.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (parsed.data.status === "DONE") {
      const unmetDependencies = await prisma.taskDependency.findMany({
        where: { taskId: id, dependsOnTask: { status: { not: "DONE" } } },
        include: { dependsOnTask: { select: { id: true, title: true, status: true } } },
      });
      if (unmetDependencies.length > 0) {
        return NextResponse.json(
          {
            error: "Task has unmet dependencies and cannot be marked DONE",
            unmetDependencies: unmetDependencies.map((d) => d.dependsOnTask),
          },
          { status: 409 }
        );
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: parsed.data,
    });

    await prisma.eventLog.create({
      data: {
        leagueId: existingTask.leagueId,
        type: "TASK_UPDATED",
        tier: task.tier,
        summary: `Task "${task.title}" updated to ${task.status}`,
        entityType: "TASK",
        entityId: id,
        taskId: id,
        meta: JSON.stringify({ taskId: id, ...parsed.data }),
      },
    });

    return NextResponse.json(task);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
